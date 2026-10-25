import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, type Snapshot } from "./plan.ts";

const e = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;
const base: Snapshot = {
  btcUsd: 80_000, tcr: 2, paused: false,
  totalAssets: e(10_000), idle: e(10_000), spDeposit: 0n, pendingBtc: 0n,
  spCapBps: 8_000, minIdleBps: 1_000, pools: [], arbs: [],
};
const pool = { address: "0x01" as const, label: "p", musdUsd: 0.98, harvestOut: e(100) };

test("deposits spare idle MUSD into the Stability Pool up to the cap", () => {
  assert.deepEqual(plan(base), [{ kind: "SP_DEPOSIT", amount: e(8_000) }]);
});

test("keeps the idle buffer plus margin", () => {
  const [a] = plan({ ...base, spCapBps: 9_500, minIdleBps: 500 });
  assert.equal(a.kind === "SP_DEPOSIT" && a.amount, e(9_300));
});

test("does nothing while paused", () => {
  assert.deepEqual(plan({ ...base, paused: true, pendingBtc: e(1) }), []);
});

test("harvests through the pool paying the most MUSD", () => {
  const better = { ...pool, address: "0x02" as const, harvestOut: e(101) };
  const [a] = plan({ ...base, idle: e(2_000), spDeposit: e(8_000), pendingBtc: e(0.01), pools: [pool, better] });
  assert.equal(a.kind === "HARVEST" && a.pool, "0x02");
});

test("picks the most profitable arb and skips unprofitable ones", () => {
  const arbs = [
    { pool: "0x01" as const, musdIn: e(1_000), expectedOut: e(1_010) },
    { pool: "0x01" as const, musdIn: e(2_000), expectedOut: e(2_015) },
    { pool: "0x01" as const, musdIn: e(500), expectedOut: e(500.2) },
  ];
  const acts = plan({ ...base, arbs });
  assert.equal(acts.length, 1);
  assert.equal(acts[0].kind === "PEG_ARB" && acts[0].arb.musdIn, e(2_000));
  assert.equal(acts[0].kind === "PEG_ARB" && acts[0].minProfit, e(7.5));
});
