import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, zeroAddress, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Action, ArbCandidate, PoolQuote, Snapshot } from "./plan.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

const A = {
  BTC: "0x7b7c000000000000000000000000000000000000",
  BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  StabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  MusdBtcPool: "0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9",
} as const;

const deployment = read("contracts/deployments/mezotestnet.json");
export const VAULT = deployment.TillerVault as `0x${string}`;
const vaultAbi = read("contracts/artifacts/contracts/TillerVault.sol/TillerVault.json").abi as Abi;
const POOLS: { address: `0x${string}`; label: string }[] = [
  { address: A.MusdBtcPool, label: "Mezo Pools MUSD/BTC" },
  ...(deployment.DrillPool ? [{ address: deployment.DrillPool, label: "Depeg drill pool" }] : []),
];

const mezo = parseAbi([
  "function fetchPrice() view returns (uint256)",
  "function getTCR(uint256) view returns (uint256)",
  "function redemptionRate() view returns (uint256)",
  "function minNetDebt() view returns (uint256)",
  "function getEntireDebtAndColl(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  "function getAmountOut(uint256,address) view returns (uint256)",
  "function getRedemptionHints(uint256,uint256,uint256) view returns (address,uint256,uint256)",
  "function findInsertPosition(uint256,address,address) view returns (address,address)",
]);

export const pub = createPublicClient({ chain: mezoTestnet, transport: http() });
const account = privateKeyToAccount(process.env.KEEPER_KEY as `0x${string}`);
const wallet = createWalletClient({ chain: mezoTestnet, transport: http(), account });

const vaultRead = (functionName: string, args: unknown[] = []) =>
  pub.readContract({ address: VAULT, abi: vaultAbi, functionName, args }) as Promise<any>;
const mezoRead = (address: `0x${string}`, functionName: any, args: any[] = []) =>
  pub.readContract({ address, abi: mezo, functionName, args: args as any }) as Promise<any>;

const E18 = 10n ** 18n;
const GAS_COMPENSATION = 200n * E18; // MUSD reserved per trove for liquidators

async function arbCandidates(idle: bigint, price: bigint): Promise<ArbCandidate[]> {
  const rate: bigint = await mezoRead(A.BorrowerOperations, "redemptionRate");
  const out: ArbCandidate[] = [];
  const minNetDebt: bigint = await mezoRead(A.BorrowerOperations, "minNetDebt");
  // halve from the whole idle balance down to 1 MUSD: shallow pools peak at small sizes
  for (let size = idle; size >= E18; size /= 2n) {
    const [first, , truncated] = await mezoRead(A.HintHelpers, "getRedemptionHints", [size, price, 50n]);
    if (truncated === 0n) continue;
    // Mezo cancels a partial redemption that leaves the trove under the minimum net debt, and the hint
    // helper doesn't truncate for that, so cap the size at what the first trove can give up.
    // The vault computes the exact hints itself in the same transaction.
    // shortcut: only sizes inside the first trove are tried; multi-trove redemptions need per-trove caps.
    const [, principal, interest] = await mezoRead(A.TroveManager, "getEntireDebtAndColl", [first]);
    const netDebt = principal + interest - GAS_COMPENSATION;
    if (truncated >= netDebt) continue;
    const cap = netDebt - minNetDebt - E18 / 100n; // 0.01 MUSD margin
    if (cap < E18) continue;
    const musdIn: bigint = truncated < cap ? truncated : cap;
    if (out.some((c) => c.musdIn === musdIn)) continue;
    const btcBack = (musdIn * E18) / price;
    const btcNet = btcBack - (btcBack * rate) / E18;
    for (const p of POOLS) {
      const expectedOut: bigint = await mezoRead(p.address, "getAmountOut", [btcNet, A.BTC]);
      out.push({ pool: p.address, musdIn, expectedOut });
    }
  }
  return out;
}

export async function snapshot(): Promise<Snapshot> {
  const [price, totalAssets, idle, pendingBtc, spCapBps, minIdleBps, paused] = await Promise.all([
    mezoRead(A.PriceFeed, "fetchPrice"),
    vaultRead("totalAssets"),
    vaultRead("idleAssets"),
    vaultRead("pendingBtc"),
    vaultRead("spCapBps"),
    vaultRead("minIdleBps"),
    vaultRead("paused"),
  ]);
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
  const arbs = tcr > (E18 * 11n) / 10n && pools.some((p) => p.musdUsd < 0.99) && idle > E18 ? await arbCandidates(idle, price) : [];
  return {
    btcUsd: Number(price) / 1e18,
    tcr: Number(tcr) / 1e18,
    paused,
    totalAssets,
    idle,
    spDeposit: (totalAssets as bigint) - (idle as bigint),
    pendingBtc,
    spCapBps: Number(spCapBps),
    minIdleBps: Number(minIdleBps),
    pools,
    arbs,
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
