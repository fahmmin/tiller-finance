import { useCallback, useEffect, useState } from "react";

// Served by the Cloudflare Worker at the same origin; every number is read from Mezo testnet.
export type Defender = { address: string; balanceMusd: number; depositedMusd: number; firstDeposit: number; deposits: number };
export type Stats = {
  updatedAt: number;
  vault: string;
  block: number;
  depositors: number;
  deposits: number;
  withdrawals: number;
  totalDepositedMusd: number;
  tvlMusd: number;
  sharePrice: number;
  pegTrades: number;
  pegProfitMusd: number;
  decisions: number;
  faucetClaims: number;
  botUsers: number;
  tvlSeries: { t: number; tvl: number }[];
  leaderboard: Defender[];
};

/** Polls /api/stats every 30 seconds. `error` is set while the API is unreachable; the last good stats stay shown. */
export function useStats() {
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok || !res.headers.get("content-type")?.includes("json")) throw new Error("the stats service isn't answering");
      setStats(await res.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);
  return { stats, error, reload: load };
}

export async function claimFaucet(address: string): Promise<{ tx: string; musd: number; btc: number }> {
  const res = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
  const body = await res.json().catch(() => ({ ok: false, error: `faucet returned ${res.status}` }));
  if (!body.ok) throw new Error(body.error ?? "The faucet couldn't send right now.");
  return body;
}

export const num = (n: number, dp = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const daysSince = (t: number) => Math.max(0, Math.floor((Date.now() / 1000 - t) / 86400));
