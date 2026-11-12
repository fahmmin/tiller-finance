import { execute, note, snapshot } from "./chain.ts";
import { fmt, plan } from "./plan.ts";
import { review } from "./review.ts";

/** One keeper round: snapshot, plan, Claude review, execute. Shared by the local loop and the Cloudflare cron. */
export async function tick({ dry = false, record }: { dry?: boolean; record?: (line: string) => void } = {}) {
  const s = await snapshot();
  const actions = plan(s);
  const prices = s.pools.map((p) => `${p.label} $${p.musdUsd.toFixed(4)}`).join(", ");
  console.log(`[${new Date().toISOString()}] vault ${fmt(s.totalAssets, 2)} MUSD | idle ${fmt(s.idle, 2)} | SP ${fmt(s.spDeposit, 2)} | ${prices}`);
  if (!actions.length) return console.log("  nothing to do");

  const r = await review(s, actions);
  console.log(`  plan: ${actions.map((a) => a.kind).join(", ")} | AI ${r.approve ? "approved" : "vetoed"} (${r.risk_level}): ${r.summary}`);
  record?.(JSON.stringify({ at: Date.now(), actions: actions.map((a) => a.kind), review: r }));
  if (dry) return;

  // no review means no move, and no on-chain note either: a 10-minute cron would otherwise spend gas on noise
  if (r.offline) return console.log("  skipped: review unavailable");
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
