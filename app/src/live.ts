import { useCallback, useEffect, useState } from "react";
import { BTC, DEPLOY_BLOCK, POOLS, PREVIOUS_VAULTS, PRICE_FEED, VAULT, decisionEvent, mezoAbi, pub, vaultAbi } from "./chain";

export type Vault = {
  total: bigint; idle: bigint; pendingBtc: bigint; sharePrice: bigint;
  spCapBps: number; minIdleBps: number; paused: boolean;
};
export type Pool = { label: string; musdUsd: number };
export type Decision = { action: string; amount: bigint; result: bigint; why: string; tx: string; time?: number; earlier: boolean };

// The redemption trade pays once MUSD is cheaper than $1 by more than the 0.75% fee plus the 0.3% swap fee.
export const ARB_LINE = 1 - 0.0075 - 0.003;

export const ACTION_TEXT: Record<string, string> = {
  SP_DEPOSIT: "Moved MUSD into the Stability Pool",
  SP_WITHDRAW: "Took MUSD out of the Stability Pool",
  HARVEST: "Sold liquidation BTC for MUSD",
  PEG_ARB: "Bought back cheap MUSD",
  NOTE: "Held off",
};

const label = (hex: string) =>
  new TextDecoder().decode(Uint8Array.from(hex.slice(2).match(/../g)!.map((b) => parseInt(b, 16)))).replace(/\0+$/, "");

/** Live Mezo testnet state shared by the landing page and the app. Polls every 20 seconds. */
export function useLive() {
  const [vault, setVault] = useState<Vault>();
  const [pools, setPools] = useState<Pool[]>([]);
  const [btcUsd, setBtcUsd] = useState<number>();
  const [feed, setFeed] = useState<Decision[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const price = await pub.readContract({ address: PRICE_FEED, abi: mezoAbi, functionName: "fetchPrice" });
    setBtcUsd(Number(price) / 1e18);
    setPools(await Promise.all(POOLS.map(async (p) => {
      // tiny probe so shallow pools quote their mid price
      const out = await pub.readContract({ address: p.address, abi: mezoAbi, functionName: "getAmountOut", args: [10n ** 12n, BTC] });
      return { label: p.label, musdUsd: Number(price) / 1e18 / (Number(out) / 1e12 / 0.997) };
    })));
    if (!VAULT) return;
    const v = { address: VAULT, abi: vaultAbi } as const;
    const [total, idle, pendingBtc, sharePrice, spCapBps, minIdleBps, paused] = await Promise.all([
      pub.readContract({ ...v, functionName: "totalAssets" }),
      pub.readContract({ ...v, functionName: "idleAssets" }),
      pub.readContract({ ...v, functionName: "pendingBtc" }),
      pub.readContract({ ...v, functionName: "convertToAssets", args: [10n ** 18n] }),
      pub.readContract({ ...v, functionName: "spCapBps" }),
      pub.readContract({ ...v, functionName: "minIdleBps" }),
      pub.readContract({ ...v, functionName: "paused" }),
    ]);
    setVault({ total, idle, pendingBtc, sharePrice, spCapBps, minIdleBps, paused });

    const latest = await pub.getBlockNumber();
    // shortcut: Mezo RPC caps log queries at 10,000 blocks; an indexer is the upgrade for a longer history
    const fromBlock = latest - 9_999n > DEPLOY_BLOCK ? latest - 9_999n : DEPLOY_BLOCK;
    const logs = await pub.getLogs({ address: [VAULT, ...PREVIOUS_VAULTS], event: decisionEvent, fromBlock, toBlock: latest });
    const recent = logs.slice(-20).reverse();
    const times = await Promise.all(recent.map((l) => pub.getBlock({ blockNumber: l.blockNumber }).then((b) => Number(b.timestamp))));
    setFeed(recent.map((l, i) => ({
      action: label(l.args.action!), amount: l.args.amount!, result: l.args.result!, why: l.args.why!,
      tx: l.transactionHash, time: times[i], earlier: l.address.toLowerCase() !== VAULT!.toLowerCase(),
    })));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(`Couldn't read Mezo testnet: ${e.shortMessage ?? e.message}`));
    const id = setInterval(() => load().catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [load]);

  return { vault, pools, btcUsd, feed, error, reload: load };
}
