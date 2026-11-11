// Tiller Telegram bot: "why did my vault do that?" answered from the on-chain decision log, plus an alert for every move.
// node --env-file=../.env src/bot.ts      (TELEGRAM_BOT_TOKEN from @BotFather; KEEPER_KEY not needed)
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { hexToString, parseAbiItem } from "viem";
import { A, DEPLOY_BLOCK, VAULT, mezoRead, pub, vaultRead } from "./chain.ts";
import { fmt } from "./plan.ts";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const EXPLORER = "https://explorer.test.mezo.org";
const SUBS_FILE = "bot-subscribers.json";
const LOG_SPAN = 9_999n; // Mezo's RPC caps a log query at 10,000 blocks
const E18 = 10n ** 18n;

const decisionEvent = parseAbiItem("event Decision(bytes32 indexed action, uint256 amount, uint256 result, string why)");

export const ACTION_TEXT: Record<string, string> = {
  SP_DEPOSIT: "Moved MUSD into Mezo's Stability Pool",
  SP_WITHDRAW: "Took MUSD out of the Stability Pool",
  HARVEST: "Sold liquidation BTC back into MUSD",
  PEG_ARB: "Bought back cheap MUSD through a Mezo redemption",
  PEG_SELL: "Sold MUSD above $1 for mUSDC",
  PEG_BUY: "Bought MUSD back at $1 or less with mUSDC",
  UNWIND: "Turned mUSDC back into MUSD for withdrawals",
  NOTE: "Held off",
};

type Decision = { action: string; amount: bigint; result: bigint; why: string; tx: string; block: bigint };

const subs = new Set<number>(fs.existsSync(SUBS_FILE) ? JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")) : []);
const saveSubs = () => fs.writeFileSync(SUBS_FILE, JSON.stringify([...subs]));

async function tg(method: string, body: object) {
  const res = await fetch(`${API}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as { ok: boolean; result: any; description?: string };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description}`);
  return json.result;
}
const send = (chat_id: number, text: string) => tg("sendMessage", { chat_id, text, link_preview_options: { is_disabled: true } });

async function decisionsBetween(fromBlock: bigint, toBlock: bigint): Promise<Decision[]> {
  const out: Decision[] = [];
  for (let from = fromBlock; from <= toBlock; from += LOG_SPAN + 1n) {
    const to = from + LOG_SPAN < toBlock ? from + LOG_SPAN : toBlock;
    const logs = await pub.getLogs({ address: VAULT, event: decisionEvent, fromBlock: from, toBlock: to });
    for (const l of logs) {
      out.push({
        action: hexToString(l.args.action!, { size: 32 }).replace(/\0+$/, ""),
        amount: l.args.amount!,
        result: l.args.result!,
        why: l.args.why!,
        tx: l.transactionHash,
        block: l.blockNumber,
      });
    }
  }
  return out;
}

export async function recentDecisions(n: number): Promise<Decision[]> {
  const latest = await pub.getBlockNumber();
  const from = latest - 20n * LOG_SPAN > DEPLOY_BLOCK ? latest - 20n * LOG_SPAN : DEPLOY_BLOCK;
  return (await decisionsBetween(from, latest)).slice(-n).reverse();
}

export function describe(d: Decision) {
  const what = ACTION_TEXT[d.action] ?? d.action;
  const numbers =
    d.action === "PEG_ARB"
      ? `${fmt(d.amount, 2)} MUSD in, +${fmt(d.result, 3)} MUSD profit`
      : d.action === "PEG_SELL"
        ? `${fmt(d.amount, 2)} MUSD sold for ${(Number(d.result) / 1e6).toFixed(2)} mUSDC`
        : d.action === "PEG_BUY" || d.action === "UNWIND"
          ? `${(Number(d.amount) / 1e6).toFixed(2)} mUSDC for ${fmt(d.result, 2)} MUSD`
          : d.action === "NOTE"
            ? ""
            : `${fmt(d.amount, 2)}`;
  return `${what}${numbers ? ` (${numbers})` : ""}\nWhy: ${d.why}\n${EXPLORER}/tx/${d.tx}`;
}

export async function status() {
  const [total, liquid, idle, stable, supply, cap, paused]: any[] = await Promise.all(
    ["totalAssets", "liquidAssets", "idleAssets", "stableAssets", "totalSupply", "depositCap", "paused"].map((f) => vaultRead(f)),
  );
  const sharePrice = supply > 0n ? Number((total * E18) / supply) / 1e18 : 1;
  return [
    `Tiller vault on Mezo testnet${paused ? " (PAUSED: deposits and trades stopped, withdrawals still open)" : ""}`,
    `Total: ${fmt(total, 2)} MUSD of a ${fmt(cap, 0)} MUSD cap`,
    `Ready to withdraw: ${fmt(idle, 2)} MUSD`,
    `In Mezo's Stability Pool: ${fmt((liquid as bigint) - (idle as bigint), 2)} MUSD`,
    `Held as mUSDC: $${fmt(stable, 2)}`,
    `Share price: ${sharePrice.toFixed(6)} MUSD per tMUSD`,
    `${EXPLORER}/address/${VAULT}`,
  ].join("\n");
}

export async function peg() {
  const price: bigint = await mezoRead(A.PriceFeed, "fetchPrice");
  const btcQuote: bigint = await mezoRead(A.MusdBtcPool, "getAmountOut", [10n ** 12n, A.BTC]);
  const btcPoolUsd = Number(price) / 1e18 / (Number(btcQuote) / 1e12 / 0.997);
  const usdcPoolUsd = Number(await mezoRead(A.MusdUsdcPool, "getAmountOut", [E18, A.MUSD])) / 1e6;
  const line = (name: string, p: number) =>
    `${name}: $${p.toFixed(4)} ${p < 0.99 ? "(below $1)" : p > 1.005 ? "(above $1.005)" : "(near $1)"}`;
  return [`MUSD price on Mezo Pools`, line("MUSD/BTC", btcPoolUsd), line("MUSD/mUSDC", usdcPoolUsd), `BTC: $${(Number(price) / 1e18).toFixed(0)}`].join("\n");
}

const claude = new Anthropic();
const ASK_SYSTEM = `You answer questions from depositors of Tiller Finance, a MUSD vault on Mezo (Bitcoin-backed stablecoin), in a Telegram chat.
The vault earns from Mezo's Stability Pool and by defending MUSD's $1 peg: below $1 it redeems MUSD for $1 of BTC and sells the BTC back
for more MUSD, or buys MUSD back with mUSDC; above $1.005 it sells MUSD for mUSDC. A rule-based keeper plans each move, a Claude review can veto it,
and the contract enforces the limits. Answer only from the vault status and decision log you are given; say so if they don't answer the question.
Plain words, no jargon, at most 5 short sentences, no markdown.`;

/** Free-text questions. Falls back to the latest decision if the API can't answer. */
export async function ask(question: string) {
  const [s, recent] = await Promise.all([status(), recentDecisions(10)]);
  const context = `Vault status:\n${s}\n\nRecent decisions, newest first:\n${recent.map(describe).join("\n\n") || "none yet"}`;
  try {
    const res = await claude.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: ASK_SYSTEM,
      messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
    } as any);
    const text = res.content.find((b: { type: string }) => b.type === "text") as { text: string } | undefined;
    if (res.stop_reason === "refusal" || !text) throw new Error(res.stop_reason ?? "no text");
    return text.text;
  } catch (err) {
    console.error("ask failed:", (err as Error).message);
    return recent[0] ? `I can't reach the AI right now. The vault's latest move:\n${describe(recent[0])}` : "I can't reach the AI right now.";
  }
}

const HELP = `Tiller Finance bot. Ask me anything about the vault in plain words, for example "why did my vault do that?"

/status  vault balances and share price
/why  the last 5 vault decisions and their reasons
/peg  MUSD's price on Mezo's pools
/alerts  get a message for every vault move (/alerts off to stop)`;

async function handle(chatId: number, text: string) {
  const [cmd, arg] = text.trim().split(/\s+/, 2);
  switch (cmd.split("@")[0]) {
    case "/start":
    case "/help":
      return send(chatId, HELP);
    case "/status":
      return send(chatId, await status());
    case "/peg":
      return send(chatId, await peg());
    case "/why": {
      const recent = await recentDecisions(5);
      return send(chatId, recent.length ? recent.map(describe).join("\n\n") : "No decisions yet.");
    }
    case "/alerts":
      if (arg === "off") subs.delete(chatId);
      else subs.add(chatId);
      saveSubs();
      return send(chatId, subs.has(chatId) ? "Alerts on. I'll message you every time the vault moves." : "Alerts off.");
    default:
      return send(chatId, await ask(text));
  }
}

async function pollTelegram() {
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        const m = u.message;
        if (m?.text) await handle(m.chat.id, m.text).catch((e) => send(m.chat.id, `Something went wrong: ${(e as Error).message.split("\n")[0]}`));
      }
    } catch (e) {
      console.error("telegram poll:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}

async function watchDecisions() {
  let next = (await pub.getBlockNumber()) + 1n;
  for (;;) {
    await new Promise((r) => setTimeout(r, 30_000));
    try {
      const latest = await pub.getBlockNumber();
      if (latest < next) continue;
      for (const d of await decisionsBetween(next, latest)) {
        for (const chat of subs) await send(chat, `Vault update\n${describe(d)}`).catch((e) => console.error("alert:", e.message));
      }
      next = latest + 1n;
    } catch (e) {
      console.error("watch:", (e as Error).message);
    }
  }
}

if (import.meta.main) {
  if (!TOKEN) throw new Error("set TELEGRAM_BOT_TOKEN in .env (create a bot with @BotFather)");
  const me = await tg("getMe", {});
  console.log(`@${me.username} running for vault ${VAULT}; ${subs.size} alert subscribers`);
  await Promise.all([pollTelegram(), watchDecisions()]);
}
