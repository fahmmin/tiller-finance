import { useCallback, useEffect, useState } from "react";
import { parseAbi } from "viem";
import { BTC, DEPLOY_BLOCK, POOLS, PREVIOUS_VAULTS, PRICE_FEED, VAULT, decisionEvent, mezoAbi, pub, vaultAbi } from "./chain";

export type Vault = {
  total: bigint; idle: bigint; pendingBtc: bigint; sharePrice: bigint; supply: bigint;
  spCapBps: number; minIdleBps: number; maxSlippageBps: number; paused: boolean;
};
export type Pool = { label: string; address: `0x${string}`; musdUsd: number };
export type Decision = {
  action: string; amount: bigint; result: bigint; why: string; tx: string; block: bigint; time?: number; earlier: boolean;
};

// The redemption trade pays once MUSD is cheaper than $1 by more than the 0.75% fee plus the 0.3% swap fee.
export const ARB_LINE = 1 - 0.0075 - 0.003;

export const ACTION_TEXT: Record<string, string> = {
  SP_DEPOSIT: "Moved MUSD into the Stability Pool",
  SP_WITHDRAW: "Took MUSD out of the Stability Pool",
  HARVEST: "Sold liquidation BTC for MUSD",
  PEG_ARB: "Bought back cheap MUSD",
  NOTE: "Held off",
};

const TROVE_MANAGER = "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0" as const;
const tcrAbi = parseAbi(["function getTCR(uint256) view returns (uint256)"]);
const extraVaultAbi = parseAbi(["function maxSlippageBps() view returns (uint16)"]);
const LOG_SPAN = 9_999n; // Mezo's RPC caps a log query at 10,000 blocks

const label = (hex: string) =>
  new TextDecoder().decode(Uint8Array.from(hex.slice(2).match(/../g)!.map((b) => parseInt(b, 16)))).replace(/\0+$/, "");

/** Every Decision event since the first vault version, fetched in 10,000-block pages. */
async function decisions(latest: bigint) {
  const logs = [];
  // shortcut: pages are read newest first and stop after 40 (about 400k blocks); an indexer is the upgrade
  for (let to = latest, i = 0; to >= DEPLOY_BLOCK && i < 40; to -= LOG_SPAN + 1n, i++) {
    const from = to - LOG_SPAN > DEPLOY_BLOCK ? to - LOG_SPAN : DEPLOY_BLOCK;
    logs.push(...(await pub.getLogs({ address: [VAULT!, ...PREVIOUS_VAULTS], event: decisionEvent, fromBlock: from, toBlock: to })));
  }
  return logs.sort((a, b) => Number(b.blockNumber - a.blockNumber));
}

/** Live Mezo testnet state shared by the landing page and the app. Polls every 20 seconds. */
export function useLive() {
  const [vault, setVault] = useState<Vault>();
  const [pools, setPools] = useState<Pool[]>([]);
  const [btcUsd, setBtcUsd] = useState<number>();
  const [tcr, setTcr] = useState<number>();
  const [block, setBlock] = useState<bigint>();
  const [feed, setFeed] = useState<Decision[]>();
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [price, latest] = await Promise.all([
      pub.readContract({ address: PRICE_FEED, abi: mezoAbi, functionName: "fetchPrice" }),
      pub.getBlockNumber(),
    ]);
    setBtcUsd(Number(price) / 1e18);
    setBlock(latest);
    pub.readContract({ address: TROVE_MANAGER, abi: tcrAbi, functionName: "getTCR", args: [price] }).then((t) => setTcr(Number(t) / 1e18)).catch(() => {});
    setPools(await Promise.all(POOLS.map(async (p) => {
      // tiny probe so shallow pools quote their mid price
      const out = await pub.readContract({ address: p.address, abi: mezoAbi, functionName: "getAmountOut", args: [10n ** 12n, BTC] });
      return { label: p.label, address: p.address, musdUsd: Number(price) / 1e18 / (Number(out) / 1e12 / 0.997) };
    })));
    if (!VAULT) return;
    const v = { address: VAULT, abi: vaultAbi } as const;
    const [total, idle, pendingBtc, sharePrice, supply, spCapBps, minIdleBps, maxSlippageBps, paused] = await Promise.all([
      pub.readContract({ ...v, functionName: "totalAssets" }),
      pub.readContract({ ...v, functionName: "idleAssets" }),
      pub.readContract({ ...v, functionName: "pendingBtc" }),
      pub.readContract({ ...v, functionName: "convertToAssets", args: [10n ** 18n] }),
      pub.readContract({ ...v, functionName: "totalSupply" }),
      pub.readContract({ ...v, functionName: "spCapBps" }),
      pub.readContract({ ...v, functionName: "minIdleBps" }),
      pub.readContract({ address: VAULT, abi: extraVaultAbi, functionName: "maxSlippageBps" }),
      pub.readContract({ ...v, functionName: "paused" }),
    ]);
    setVault({ total, idle, pendingBtc, sharePrice, supply, spCapBps, minIdleBps, maxSlippageBps, paused });

    const logs = await decisions(latest);
    const recent = logs.slice(0, 60);
    const times = await Promise.all(recent.map((l) => pub.getBlock({ blockNumber: l.blockNumber }).then((b) => Number(b.timestamp))));
    setFeed(recent.map((l, i) => ({
      action: label(l.args.action!), amount: l.args.amount!, result: l.args.result!, why: l.args.why!,
      tx: l.transactionHash, block: l.blockNumber, time: times[i], earlier: l.address.toLowerCase() !== VAULT!.toLowerCase(),
    })));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(`Couldn't read Mezo testnet: ${e.shortMessage ?? e.message}`));
    const id = setInterval(() => load().catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [load]);

  return { vault, pools, btcUsd, tcr, block, feed, error, reload: load };
}
