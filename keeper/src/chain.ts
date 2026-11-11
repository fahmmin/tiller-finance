import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, zeroAddress, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Action, ArbCandidate, PoolQuote, Snapshot, StableTrade } from "./plan.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

export const A = {
  BTC: "0x7b7c000000000000000000000000000000000000",
  BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  StabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  MusdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  MusdUsdcPool: "0x525F049A4494dA0a6c87E3C4df55f9929765Dc3e",
} as const;

const deployment = read("contracts/deployments/mezotestnet.json");
export const VAULT = deployment.TillerVault as `0x${string}`;
export const DEPLOY_BLOCK = BigInt(deployment.deployBlock);
const vaultAbi = read("contracts/artifacts/contracts/TillerVault.sol/TillerVault.json").abi as Abi;
const POOLS: { address: `0x${string}`; label: string }[] = [
  { address: A.MusdBtcPool, label: "Mezo Pools MUSD/BTC" },
  // the drill pool is only for rehearsals; v4 trades on Mezo's own pool
  ...(process.env.DRILL_MODE === "1" && deployment.DrillPool ? [{ address: deployment.DrillPool, label: "Depeg drill pool" }] : []),
];

const mezo = parseAbi([
  "function fetchPrice() view returns (uint256)",
  "function getTCR(uint256) view returns (uint256)",
  "function getAmountOut(uint256,address) view returns (uint256)",
]);

export const pub = createPublicClient({ chain: mezoTestnet, transport: http() });
// read-only users (the Telegram bot) run without KEEPER_KEY; only keeper actions need it
const account = process.env.KEEPER_KEY ? privateKeyToAccount(process.env.KEEPER_KEY as `0x${string}`) : undefined!;
const wallet = createWalletClient({ chain: mezoTestnet, transport: http(), account });

export const vaultRead = (functionName: string, args: unknown[] = []) =>
  pub.readContract({ address: VAULT, abi: vaultAbi, functionName, args }) as Promise<any>;
export const mezoRead = (address: `0x${string}`, functionName: any, args: any[] = []) =>
  pub.readContract({ address, abi: mezo, functionName, args: args as any }) as Promise<any>;

const E18 = 10n ** 18n;
const E12 = 10n ** 12n; // mUSDC has 6 decimals

// Ask the vault what a call would return. This runs Mezo's real redemption and pool code, so multi-trove
// redemptions, cancelled partials and pool depth are all priced exactly. A revert means "skip this size".
async function simulate(functionName: string, args: unknown[]): Promise<bigint | null> {
  try {
    const { result } = await pub.simulateContract({ address: VAULT, abi: vaultAbi, account, functionName, args } as any);
    return result as bigint;
  } catch {
    return null;
  }
}

// halve from `max` down to one unit: shallow pools peak at small sizes
function* sizes(max: bigint, unit: bigint) {
  for (let size = max; size >= unit; size /= 2n) yield size;
}

async function arbCandidates(idle: bigint): Promise<ArbCandidate[]> {
  const out: ArbCandidate[] = [];
  for (const p of POOLS) {
    for (const musdIn of sizes(idle, E18)) {
      const profit = await simulate("pegArb", [musdIn, p.address, 0n, "quote"]);
      if (profit !== null) out.push({ pool: p.address, musdIn, expectedOut: musdIn + profit });
    }
  }
  return out;
}

async function stableTrades(idle: bigint, stableHeld: bigint, musdUsd: number): Promise<StableTrade[]> {
  const out: StableTrade[] = [];
  const pool = A.MusdUsdcPool as `0x${string}`;
  if (musdUsd > 1.005 && idle > E18) {
    for (const musdIn of sizes(idle, E18)) {
      const got = await simulate("pegSell", [musdIn, pool, "quote"]);
      if (got !== null) out.push({ kind: "PEG_SELL", pool, amountIn: musdIn, gain: got * E12 - musdIn });
    }
  }
  if (musdUsd < 1 && stableHeld > 10n ** 6n) {
    for (const stableIn of sizes(stableHeld, 10n ** 6n)) {
      const got = await simulate("pegBuy", [stableIn, pool, "quote"]);
      if (got !== null) out.push({ kind: "PEG_BUY", pool, amountIn: stableIn, gain: got - stableIn * E12 });
    }
  }
  return out;
}

export async function snapshot(): Promise<Snapshot> {
  const [price, totalAssets, idle, pendingBtc, spCapBps, minIdleBps, paused, stable, liquid] = await Promise.all([
    mezoRead(A.PriceFeed, "fetchPrice"),
    vaultRead("totalAssets"),
    vaultRead("idleAssets"),
    vaultRead("pendingBtc"),
    vaultRead("spCapBps"),
    vaultRead("minIdleBps"),
    vaultRead("paused"),
    vaultRead("stableAssets"),
    vaultRead("liquidAssets"),
  ]);
  // 1 MUSD into the MUSD/mUSDC pool, fee included: what MUSD is worth in dollars there
  const stableMusdUsd = Number(await mezoRead(A.MusdUsdcPool, "getAmountOut", [E18, A.MUSD])) / 1e6;
  const tcr: bigint = await mezoRead(A.TroveManager, "getTCR", [price]);
  const probe = 10n ** 12n; // 0.000001 BTC: small enough not to move even the drill pool
  const pools: PoolQuote[] = await Promise.all(
    POOLS.map(async (p) => {
      const q: bigint = await mezoRead(p.address, "getAmountOut", [probe, A.BTC]);
      const harvestOut: bigint = pendingBtc > 0n ? await mezoRead(p.address, "getAmountOut", [pendingBtc, A.BTC]) : 0n;
      // undo the 0.3% fee to get the mid price; MUSD price = BTC/USD over MUSD per BTC
      const musdPerBtc = Number(q) / 1e12 / 0.997;
      return { ...p, musdUsd: Number(price) / 1e18 / musdPerBtc, harvestOut };
    }),
  );
  // redemptions need TCR above 110%, and arbs only pay below the peg
  const arbs = !paused && tcr > (E18 * 11n) / 10n && pools.some((p) => p.musdUsd < 0.99) && idle > E18 ? await arbCandidates(idle) : [];
  return {
    btcUsd: Number(price) / 1e18,
    tcr: Number(tcr) / 1e18,
    paused,
    totalAssets,
    idle,
    spDeposit: (liquid as bigint) - (idle as bigint),
    pendingBtc,
    stable,
    stableMusdUsd,
    spCapBps: Number(spCapBps),
    minIdleBps: Number(minIdleBps),
    pools,
    arbs,
    stableTrades: paused ? [] : await stableTrades(idle, (stable as bigint) / E12, stableMusdUsd),
  };
}

// Mezo's RPC returns a far-too-low estimate when viem sends the local account's extra fields, so estimate from the
// plain address and add 30%.
const gasFor = async (call: { functionName: string; args: unknown[] }) =>
  ((await pub.estimateContractGas({ address: VAULT, abi: vaultAbi, account: account.address, ...call } as any)) * 13n) / 10n;

async function mined(hash: `0x${string}`) {
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`transaction ${hash} reverted on-chain`);
}

const why280 = (s: string) => (s.length > 280 ? s.slice(0, 277) + "..." : s);

export async function execute(action: Action, why: string): Promise<`0x${string}`> {
  const call =
    action.kind === "HARVEST"
      ? { functionName: "harvest", args: [action.pool, why280(why)] }
      : action.kind === "PEG_ARB"
        ? { functionName: "pegArb", args: [action.arb.musdIn, action.arb.pool, action.minProfit, why280(why)] }
        : action.kind === "PEG_SELL" || action.kind === "PEG_BUY"
          ? { functionName: action.kind === "PEG_SELL" ? "pegSell" : "pegBuy", args: [action.trade.amountIn, action.trade.pool, why280(why)] }
          : { functionName: "depositToStabilityPool", args: [action.amount, why280(why)] };
  // simulate first: if Mezo state moved and a guard would revert, nothing is sent
  const { request } = await pub.simulateContract({ address: VAULT, abi: vaultAbi, account, ...call });
  const hash = await wallet.writeContract({ ...request, gas: await gasFor(call) });
  await mined(hash);
  return hash;
}

export async function note(why: string): Promise<`0x${string}`> {
  const call = { functionName: "note", args: [why280(why)] };
  const hash = await wallet.writeContract({ address: VAULT, abi: vaultAbi, ...call, chain: mezoTestnet, gas: await gasFor(call) });
  await mined(hash);
  return hash;
}

export { zeroAddress };
