import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { fmt, type Action, type Snapshot } from "./plan.ts";

const Review = z.object({
  approve: z.boolean(),
  risk_level: z.enum(["low", "medium", "high"]),
  summary: z.string().describe("One or two plain sentences for depositors, under 260 characters."),
  concerns: z.array(z.string()),
});
export type Review = z.infer<typeof Review>;

const SYSTEM = `You are the risk reviewer for Tiller Finance, a MUSD vault on Mezo (Bitcoin-backed stablecoin).
The vault earns by depositing MUSD in Mezo's Stability Pool (absorbs liquidations for discounted BTC) and by peg arbitrage:
when MUSD trades under $1 it redeems MUSD for $1 of BTC (0.75% fee) and sells that BTC back for more MUSD, pushing MUSD toward $1.

A rule-based keeper proposes actions. You approve or veto the whole batch. Your veto can only make the vault do less.
The contract already enforces: whitelisted pools, Stability Pool cap, idle buffer, oracle-checked swap prices, and that arbitrage ends with more MUSD.
Veto when something looks wrong that the contract can't see: a pool price far from other pools, a sudden system-wide stress sign (TCR near 150% means Recovery Mode is close),
a harvest selling BTC far below the oracle, or numbers that don't add up. Approve routine actions; don't veto just because you are unsure in general.
Write the summary for depositors: what the vault is doing and why, in plain words, no jargon like "ICR" or "bps".`;

// Testnet only: Mezo testnet MUSD trades above $1, so operators rehearse with a labelled drill pool.
const DRILL = `\n\nDrill mode is on (Mezo testnet). The "Depeg drill pool" is an operator-run rehearsal pool seeded below $1 on purpose.
Judge drill trades on whether the math and guardrails hold, not on the pool being a test pool, and say "drill" in the summary.`;

const client = new Anthropic();

function describe(s: Snapshot, actions: Action[]) {
  return JSON.stringify(
    {
      market: { btc_usd: s.btcUsd, system_collateral_ratio: s.tcr },
      vault: {
        total_musd: fmt(s.totalAssets, 2),
        idle_musd: fmt(s.idle, 2),
        stability_pool_musd: fmt(s.spDeposit, 2),
        unharvested_btc: fmt(s.pendingBtc, 6),
        stability_pool_cap_pct: s.spCapBps / 100,
        idle_floor_pct: s.minIdleBps / 100,
      },
      pools: s.pools.map((p) => ({ name: p.label, musd_price_usd: p.musdUsd.toFixed(4) })),
      proposed_actions: actions.map((a) =>
        a.kind === "HARVEST"
          ? { action: "harvest", sell_btc: fmt(s.pendingBtc, 6), expected_musd: fmt(a.expectedOut, 2) }
          : a.kind === "PEG_ARB"
            ? { action: "peg_arbitrage", redeem_musd: fmt(a.arb.musdIn, 2), expected_musd_back: fmt(a.arb.expectedOut, 2), min_profit: fmt(a.minProfit, 2) }
            : { action: "stability_pool_deposit", musd: fmt(a.amount, 2) },
      ),
    },
    null,
    2,
  );
}

/** Fails closed: any API error or refusal counts as a veto, so the AI being down never moves money. */
export async function review(s: Snapshot, actions: Action[]): Promise<Review> {
  try {
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: process.env.DRILL_MODE === "1" ? SYSTEM + DRILL : SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(Review) },
      messages: [{ role: "user", content: describe(s, actions) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return { approve: false, risk_level: "medium", summary: "Paused this round: the risk review gave no answer.", concerns: [res.stop_reason ?? "no output"] };
    }
    return res.parsed_output;
  } catch (err) {
    return { approve: false, risk_level: "medium", summary: "Paused this round: the risk review was unreachable.", concerns: [String(err)] };
  }
}
