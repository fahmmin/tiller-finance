// node --env-file=../.env src/keeper.ts [--once] [--dry]
import fs from "node:fs";
import { execute, note, snapshot } from "./chain.ts";
import { fmt, plan } from "./plan.ts";
import { review } from "./review.ts";

const once = process.argv.includes("--once");
const dry = process.argv.includes("--dry");
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MIN ?? 10) * 60_000;

async function tick() {
  const s = await snapshot();
  const actions = plan(s);
  const prices = s.pools.map((p) => `${p.label} $${p.musdUsd.toFixed(4)}`).join(", ");
  console.log(`[${new Date().toISOString()}] vault ${fmt(s.totalAssets, 2)} MUSD | idle ${fmt(s.idle, 2)} | SP ${fmt(s.spDeposit, 2)} | ${prices}`);
  if (!actions.length) return console.log("  nothing to do");

  const r = await review(s, actions);
  console.log(`  plan: ${actions.map((a) => a.kind).join(", ")} | AI ${r.approve ? "approved" : "vetoed"} (${r.risk_level}): ${r.summary}`);
  fs.appendFileSync("decisions.jsonl", JSON.stringify({ at: Date.now(), actions: actions.map((a) => a.kind), review: r }) + "\n");
  if (dry) return;

  if (!r.approve) return console.log("  note tx", await note(`AI veto: ${r.summary}`));
  for (const a of actions) {
    try {
      console.log(`  ${a.kind} tx`, await execute(a, r.summary));
    } catch (err) {
      // a guard reverted in simulation (state moved); skip, the next tick re-plans
      console.log(`  ${a.kind} skipped:`, (err as any).details ?? (err as Error).message.split("\n")[0]);
    }
  }
}

do {
  await tick().catch((e) => console.error("tick failed:", e));
  if (!once) await new Promise((r) => setTimeout(r, INTERVAL_MS));
} while (!once);
