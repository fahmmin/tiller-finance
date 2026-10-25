import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, type Abi } from "viem";
import { MUSD, VAULT, erc20Abi, mezoTestnet, pub, vaultAbi } from "../chain";

declare global {
  interface Window { ethereum?: any }
}

const REMEMBER = "tiller.connected";
const remembered = () => { try { return localStorage.getItem(REMEMBER) === "1"; } catch { return false; } };
const remember = (on: boolean) => { try { on ? localStorage.setItem(REMEMBER, "1") : localStorage.removeItem(REMEMBER); } catch { /* storage blocked */ } };

export type Account = { musd: bigint; shares: bigint; value: bigint; maxWithdraw: bigint; allowance: bigint; btc: bigint };

/** Injected wallet (MetaMask, Rabby, OKX…): connect, stay connected across reloads, follow account and network changes. */
export function useWallet() {
  const eth = typeof window !== "undefined" ? window.ethereum : undefined;
  const [address, setAddress] = useState<`0x${string}`>();
  const [chainId, setChainId] = useState<number>();
  const [account, setAccount] = useState<Account>();

  useEffect(() => {
    if (!eth) return;
    const onAccounts = (a: string[]) => setAddress(a[0] as `0x${string}` | undefined);
    const onChain = (id: string) => setChainId(parseInt(id, 16));
    eth.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    if (remembered()) eth.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [eth]);

  const wrongNetwork = !!address && chainId !== mezoTestnet.id;

  const switchNetwork = useCallback(async () => {
    const w = createWalletClient({ chain: mezoTestnet, transport: custom(eth) });
    try {
      await w.switchChain({ id: mezoTestnet.id });
    } catch {
      await w.addChain({ chain: mezoTestnet });
    }
  }, [eth]);

  const connect = useCallback(async () => {
    if (!eth) throw new Error("No browser wallet found. Install MetaMask or Rabby, then reload.");
    const [a] = await eth.request({ method: "eth_requestAccounts" });
    setAddress(a);
    remember(true);
    if (parseInt(await eth.request({ method: "eth_chainId" }), 16) !== mezoTestnet.id) await switchNetwork();
  }, [eth, switchNetwork]);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setAccount(undefined);
    remember(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!address || !VAULT) return;
    const [musd, shares, maxWithdraw, allowance, btc] = await Promise.all([
      pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "balanceOf", args: [address] }),
      pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "maxWithdraw", args: [address] }),
      pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "allowance", args: [address, VAULT] }),
      pub.getBalance({ address }),
    ]);
    const value = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "convertToAssets", args: [shares] });
    setAccount({ musd, shares, value, maxWithdraw, allowance, btc });
  }, [address]);

  useEffect(() => {
    if (!address) return;
    refresh().catch(() => {});
    const id = setInterval(() => refresh().catch(() => {}), 20_000);
    return () => clearInterval(id);
  }, [address, refresh]);

  const client = useMemo(() => (eth && address ? createWalletClient({ chain: mezoTestnet, transport: custom(eth), account: address }) : undefined), [eth, address]);

  /** Sends a contract call and waits for it. Mezo's RPC under-estimates gas when the wallet fills it in, so we estimate from the address and add 30%. */
  const send = useCallback(async (call: { address: `0x${string}`; abi: Abi; functionName: string; args: unknown[] }) => {
    if (!client || !address) throw new Error("Connect a wallet first.");
    const gas = ((await pub.estimateContractGas({ ...call, account: address } as any)) * 13n) / 10n;
    const hash = await client.writeContract({ ...call, chain: mezoTestnet, account: address, gas } as any);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw Object.assign(new Error("The transaction reverted on Mezo. Nothing moved."), { hash });
    return hash;
  }, [client, address]);

  return { hasWallet: !!eth, address, chainId, wrongNetwork, account, connect, disconnect, switchNetwork, refresh, send };
}

export type Wallet = ReturnType<typeof useWallet>;
