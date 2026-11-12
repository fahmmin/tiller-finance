// Cloudflare Worker in front of the static site: public stats, the testnet faucet, the Telegram webhook,
// and a 10-minute cron that runs the keeper and sends bot alerts. Everything else is served from ./dist.
import { isAddress, parseAbi, parseAbiItem, hexToString, type Log } from "viem";
import { DEPLOY_BLOCK, FAUCET, VAULT, keeperSigner, mezoTestnet, pub, vaultRead } from "../../keeper/src/chain.ts";
import { alert, handle, send, type SubStore } from "../../keeper/src/bot.ts";
import { tick } from "../../keeper/src/tick.ts";

type KV = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};
type Env = { ASSETS: { fetch(req: Request): Promise<Response> }; TILLER: KV; TELEGRAM_WEBHOOK_SECRET: string };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const LOG_SPAN = 9_999n; // Mezo's RPC caps a log query at 10,000 blocks
const STATS_TTL = 60; // seconds
const vaultEvents = [
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
  parseAbiItem("event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"),
  parseAbiItem("event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"),
  parseAbiItem("event Decision(bytes32 indexed action, uint256 amount, uint256 result, string why)"),
];
const faucetAbi = parseAbi(["function drip(address to)", "function claims() view returns (uint256)", "function claimed(address) view returns (bool)"]);
const ZERO = "0x0000000000000000000000000000000000000000";
const n18 = (x: bigint) => Number(x) / 1e18;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

function kvSubs(kv: KV): SubStore {
  return {
    async list() {
      const ids: number[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix: "sub:", cursor });
        ids.push(...page.keys.map((k) => Number(k.name.slice(4))));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return ids;
    },
    set: (id, on) => (on ? kv.put(`sub:${id}`, "1") : kv.delete(`sub:${id}`)),
    seen: (id) => kv.put(`user:${id}`, "1"),
  };
}

async function countKeys(kv: KV, prefix: string) {
  let n = 0;
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor });
    n += page.keys.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return n;
}

async function stats(env: Env) {
  const latest = await pub.getBlockNumber();
  const logs: Log[] = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += LOG_SPAN + 1n) {
    const to = from + LOG_SPAN < latest ? from + LOG_SPAN : latest;
    logs.push(...((await pub.getLogs({ address: VAULT, events: vaultEvents, fromBlock: from, toBlock: to })) as Log[]));
  }
  const [first, last, total, supply, faucetClaims, botUsers] = await Promise.all([
    pub.getBlock({ blockNumber: DEPLOY_BLOCK }),
    pub.getBlock({ blockNumber: latest }),
    vaultRead("totalAssets") as Promise<bigint>,
    vaultRead("totalSupply") as Promise<bigint>,
    FAUCET ? (pub.readContract({ address: FAUCET, abi: faucetAbi, functionName: "claims" }) as Promise<bigint>) : Promise.resolve(0n),
    countKeys(env.TILLER, "user:"),
  ]);
  // shortcut: event times are interpolated between two block timestamps instead of one RPC call per event; exact enough for a chart
  const span = Number(latest - DEPLOY_BLOCK) || 1;
  const time = (b: bigint) => Math.round(Number(first.timestamp) + (Number(last.timestamp - first.timestamp) * Number(b - DEPLOY_BLOCK)) / span);
  const sharePrice = supply > 0n ? Number((total * 10n ** 18n) / supply) / 1e18 : 1;

  const shares = new Map<string, bigint>();
  const people = new Map<string, { deposited: bigint; deposits: number; firstDeposit: number }>();
  const tvlSeries: { t: number; tvl: number }[] = [{ t: Number(first.timestamp), tvl: 0 }];
  let tvl = 0n, deposits = 0, withdrawals = 0, totalDeposited = 0n, pegTrades = 0, pegProfit = 0n, decisions = 0;
  for (const l of logs as (Log & { eventName: string; args: any })[]) {
    const a = l.args;
    if (l.eventName === "Transfer") {
      if (a.from !== ZERO) shares.set(a.from, (shares.get(a.from) ?? 0n) - a.value);
      if (a.to !== ZERO) shares.set(a.to, (shares.get(a.to) ?? 0n) + a.value);
    } else if (l.eventName === "Deposit") {
      deposits++;
      totalDeposited += a.assets;
      tvl += a.assets;
      const p = people.get(a.owner) ?? { deposited: 0n, deposits: 0, firstDeposit: time(l.blockNumber!) };
      p.deposited += a.assets;
      p.deposits++;
      people.set(a.owner, p);
      tvlSeries.push({ t: time(l.blockNumber!), tvl: n18(tvl) });
    } else if (l.eventName === "Withdraw") {
      withdrawals++;
      tvl -= a.assets;
      tvlSeries.push({ t: time(l.blockNumber!), tvl: n18(tvl) });
    } else if (l.eventName === "Decision") {
      decisions++;
      const action = hexToString(a.action, { size: 32 }).replace(/\0+$/, "");
      if (action === "PEG_ARB") {
        pegTrades++;
        pegProfit += a.result;
      }
    }
  }
  tvlSeries.push({ t: Number(last.timestamp), tvl: n18(total) });

  const leaderboard = [...people.entries()]
    .map(([address, p]) => ({
      address,
      balanceMusd: n18(shares.get(address) ?? 0n) * sharePrice,
      depositedMusd: n18(p.deposited),
      firstDeposit: p.firstDeposit,
      deposits: p.deposits,
    }))
    .sort((x, y) => y.balanceMusd - x.balanceMusd);

  return {
    updatedAt: Date.now(),
    vault: VAULT,
    block: Number(latest),
    depositors: people.size,
    deposits,
    withdrawals,
    totalDepositedMusd: n18(totalDeposited),
    tvlMusd: n18(total),
    sharePrice,
    pegTrades,
    pegProfitMusd: n18(pegProfit),
    decisions,
    faucetClaims: Number(faucetClaims),
    botUsers,
    tvlSeries,
    leaderboard,
  };
}

async function cachedStats(req: Request, env: Env, ctx: Ctx) {
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL("/api/stats", req.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json(await stats(env));
  res.headers.set("cache-control", `public, max-age=${STATS_TTL}`);
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function faucet(req: Request, env: Env) {
  if (!FAUCET) return json({ ok: false, error: "Faucet not deployed" }, 503);
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return json({ ok: false, error: "Send a valid wallet address" }, 400);
  // one claim per wallet is enforced on-chain; one per IP per day here keeps a single person from draining it
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  if (await env.TILLER.get(`ip:${ip}`)) return json({ ok: false, error: "This network already claimed today. Try again tomorrow." }, 429);
  if (await pub.readContract({ address: FAUCET, abi: faucetAbi, functionName: "claimed", args: [address] })) {
    return json({ ok: false, error: "This wallet already got its test MUSD." }, 409);
  }
  const { account, wallet } = keeperSigner();
  try {
    // shortcut: the faucet and the keeper cron share one key, so a drip landing mid-cron can collide on nonce; retry once the cron is done
    const { request } = await pub.simulateContract({ address: FAUCET, abi: faucetAbi, functionName: "drip", args: [address], account });
    const gas = (await pub.estimateContractGas({ address: FAUCET, abi: faucetAbi, functionName: "drip", args: [address], account: account.address })) * 13n / 10n;
    const tx = await wallet.writeContract({ ...request, gas, chain: mezoTestnet } as any);
    await env.TILLER.put(`ip:${ip}`, "1", { expirationTtl: 86_400 });
    return json({ ok: true, tx, musd: 100, btc: 0.00002 });
  } catch (e) {
    const msg = (e as { shortMessage?: string }).shortMessage ?? (e as Error).message;
    return json({ ok: false, error: /Empty/.test(msg) ? "The faucet is empty right now. We're refilling it." : msg.split("\n")[0] }, 500);
  }
}

async function telegram(req: Request, env: Env, ctx: Ctx) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  const update = (await req.json()) as { message?: { chat: { id: number }; text?: string } };
  const m = update.message;
  // answer Telegram at once; the reply (which may call Claude) goes out in the background
  if (m?.text) {
    ctx.waitUntil(
      handle(m.chat.id, m.text, kvSubs(env.TILLER))
        .catch((e) => `Something went wrong: ${(e as Error).message.split("\n")[0]}`)
        .then((text) => send(m.chat.id, text)),
    );
  }
  return new Response("ok");
}

export default {
  async fetch(req: Request, env: Env, ctx: Ctx) {
    const { pathname } = new URL(req.url);
    try {
      if (pathname === "/api/stats" && req.method === "GET") return await cachedStats(req, env, ctx);
      if (pathname === "/api/faucet" && req.method === "POST") return await faucet(req, env);
      if (pathname === "/api/telegram" && req.method === "POST") return await telegram(req, env, ctx);
      if (pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ ok: false, error: (e as { shortMessage?: string }).shortMessage ?? (e as Error).message }, 500);
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    ctx.waitUntil(
      (async () => {
        await tick().catch((e) => console.error("keeper tick failed:", e));
        const from = BigInt((await env.TILLER.get("alert:next")) ?? (await pub.getBlockNumber()).toString());
        const next = await alert(from, kvSubs(env.TILLER));
        await env.TILLER.put("alert:next", next.toString());
      })(),
    );
  },
};
