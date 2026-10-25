// Pure planning rules. All amounts are 18-decimal bigints (MUSD or BTC).

export type PoolQuote = {
  address: `0x${string}`;
  label: string;
  musdUsd: number; // implied MUSD price in USD from a small BTC->MUSD quote
  harvestOut: bigint; // MUSD out for selling all pending BTC
};

export type ArbCandidate = {
  pool: `0x${string}`;
  musdIn: bigint; // truncated to what Mezo can redeem
  expectedOut: bigint;
};

export type Snapshot = {
  btcUsd: number;
  tcr: number; // system collateral ratio, e.g. 1.85
  paused: boolean;
  totalAssets: bigint;
  idle: bigint;
  spDeposit: bigint;
  pendingBtc: bigint;
  spCapBps: number;
  minIdleBps: number;
  pools: PoolQuote[];
  arbs: ArbCandidate[];
};

export type Action =
  | { kind: "HARVEST"; pool: `0x${string}`; expectedOut: bigint }
  | { kind: "PEG_ARB"; arb: ArbCandidate; minProfit: bigint }
  | { kind: "SP_DEPOSIT"; amount: bigint };

const E18 = 10n ** 18n;
export const DUST_BTC = 10n ** 14n; // 0.0001 BTC
// 0.5 MUSD by default, covers keeper gas with room; the testnet drill sets it lower via env
export const MIN_ARB_PROFIT = BigInt(Math.round(Number(process.env.MIN_ARB_PROFIT ?? 0.5) * 1e6)) * 10n ** 12n;
const IDLE_MARGIN_BPS = 200n; // keep 2% above the on-chain idle floor so deposits don't trip it

export function plan(s: Snapshot): Action[] {
  if (s.paused) return [];
  const actions: Action[] = [];

  if (s.pendingBtc > DUST_BTC && s.pools.length) {
    const best = s.pools.reduce((a, b) => (b.harvestOut > a.harvestOut ? b : a));
    actions.push({ kind: "HARVEST", pool: best.address, expectedOut: best.harvestOut });
  }

  const bestArb = s.arbs
    .map((a) => ({ a, profit: a.expectedOut - a.musdIn }))
    .filter((x) => x.profit >= MIN_ARB_PROFIT)
    .sort((x, y) => (y.profit > x.profit ? 1 : -1))[0];
  // require at least half the quoted profit on-chain, so price moves before inclusion can't turn it into a loss
  if (bestArb) actions.push({ kind: "PEG_ARB", arb: bestArb.a, minProfit: bestArb.profit / 2n });

  const room = (s.totalAssets * BigInt(s.spCapBps)) / 10_000n - s.spDeposit;
  const spare = s.idle - (s.totalAssets * (BigInt(s.minIdleBps) + IDLE_MARGIN_BPS)) / 10_000n;
  const amount = room < spare ? room : spare;
  // shortcut: arb and deposit are planned from the same snapshot; the deposit is skipped if an arb runs first
  if (amount > E18 && !bestArb) actions.push({ kind: "SP_DEPOSIT", amount });

  return actions;
}

export const fmt = (x: bigint, dp = 4) => (Number(x) / 1e18).toFixed(dp);
