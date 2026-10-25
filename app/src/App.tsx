import { useCallback, useState } from "react";
import { createWalletClient, custom, maxUint256, parseEther, type WalletClient } from "viem";
import { EXPLORER, MUSD, VAULT, erc20Abi, fmt, mezoTestnet, pub, vaultAbi } from "./chain";
import { PegGauge } from "./Gauge";
import { ACTION_TEXT, useLive } from "./live";
import { GITHUB } from "./proof";
import { CtaLink, Logo, Tag } from "./ui";

type Me = { address: `0x${string}`; musd: bigint; shares: bigint; value: bigint };

declare global {
  interface Window { ethereum?: any }
}

export default function App() {
  const { vault, pools, btcUsd, feed, error, reload } = useLive();
  const [wallet, setWallet] = useState<WalletClient>();
  const [me, setMe] = useState<Me>();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const loadMe = useCallback(async (address: `0x${string}`) => {
    if (!VAULT) return;
    const [musd, shares] = await Promise.all([
      pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "balanceOf", args: [address] }),
    ]);
    const value = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: "convertToAssets", args: [shares] });
    setMe({ address, musd, shares, value });
  }, []);

  async function connect() {
    if (!window.ethereum) return setStatus("Install a browser wallet such as MetaMask to deposit.");
    const w = createWalletClient({ chain: mezoTestnet, transport: custom(window.ethereum) });
    const [address] = await w.requestAddresses();
    try {
      await w.switchChain({ id: mezoTestnet.id });
    } catch {
      await w.addChain({ chain: mezoTestnet });
    }
    setWallet(w);
    await loadMe(address);
  }

  // Mezo's RPC under-estimates gas when a wallet fills it in, so estimate from the address and add 30%.
  const gasFor = async (address: `0x${string}`, call: any) =>
    ((await pub.estimateContractGas({ account: me!.address, address, ...call })) * 13n) / 10n;

  async function send(kind: "deposit" | "withdraw") {
    if (!wallet || !me || !VAULT) return;
    let assets: bigint;
    try {
      assets = parseEther(amount);
    } catch {
      return setStatus("Enter an amount of MUSD, like 250.");
    }
    if (assets <= 0n) return setStatus("Enter an amount of MUSD, like 250.");
    try {
      if (kind === "deposit") {
        const allowance = await pub.readContract({ address: MUSD, abi: erc20Abi, functionName: "allowance", args: [me.address, VAULT] });
        if (allowance < assets) {
          setStatus("Approve MUSD in your wallet…");
          const call = { abi: erc20Abi, functionName: "approve", args: [VAULT, maxUint256] };
          const h = await wallet.writeContract({ account: me.address, chain: mezoTestnet, address: MUSD, ...call, gas: await gasFor(MUSD, call) } as any);
          await pub.waitForTransactionReceipt({ hash: h });
        }
      }
      setStatus(kind === "deposit" ? "Confirm the deposit in your wallet…" : "Confirm the withdrawal in your wallet…");
      const call = { abi: vaultAbi, functionName: kind, args: kind === "deposit" ? [assets, me.address] : [assets, me.address, me.address] };
      const hash = await wallet.writeContract({ account: me.address, chain: mezoTestnet, address: VAULT, ...call, gas: await gasFor(VAULT, call) } as any);
      const r = await pub.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("The transaction reverted on Mezo. Nothing moved.");
      setStatus(kind === "deposit" ? `Deposited ${amount} MUSD.` : `Withdrew ${amount} MUSD.`);
      setAmount("");
      await Promise.all([reload(), loadMe(me.address)]);
    } catch (e: any) {
      setStatus(e.shortMessage ?? e.message);
    }
  }

  const sp = vault ? vault.total - vault.idle : undefined;

  return (
    <div className="site app">
      <header className="nav">
        <Logo />
        <nav aria-label="Sections">
          <a href="/">Overview</a>
          <a href="#log">Log</a>
          {VAULT && <a href={`${EXPLORER}/address/${VAULT}`} target="_blank" rel="noreferrer">Contract</a>}
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        {me ? <span className="who">{me.address.slice(0, 6)}…{me.address.slice(-4)}</span>
            : <button className="cta" onClick={connect}><span>Connect wallet</span></button>}
      </header>

      <section className="hero app-hero">
        <Tag>Mezo testnet vault</Tag>
        <h1 className="app-title">Your MUSD, holding the line.</h1>
        {error && <p className="status">{error}</p>}
      </section>

      <article className="card light gauge-card">
        <div className="card-head">
          <h2>MUSD price by pool</h2>
          <span className="live-dot">{btcUsd ? `BTC $${btcUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "Loading"}</span>
        </div>
        <PegGauge pools={pools} />
        <p className="small muted">Left of the dashed line, redeeming MUSD for $1 of BTC and selling the BTC back pays for itself. The drill pool is a testnet rehearsal.</p>
      </article>

      {!VAULT ? (
        <p className="empty">The vault isn't deployed yet. Run the deploy script, then reload.</p>
      ) : (
        <div className="app-grid">
          <section className="card teal vault-card" aria-label="Vault">
            <span className="muted-light">MUSD in the vault</span>
            <strong className="big lime-text">{fmt(vault?.total)}</strong>
            <dl className="stats">
              <div><dt>Value of 1 tMUSD</dt><dd>{fmt(vault?.sharePrice, 4)}</dd></div>
              <div><dt>Ready for withdrawals</dt><dd>{fmt(vault?.idle)}</dd></div>
              <div><dt>In the Stability Pool</dt><dd>{fmt(sp)}</dd></div>
              <div><dt>BTC waiting to be sold</dt><dd>{fmt(vault?.pendingBtc, 6)}</dd></div>
            </dl>
            {vault && (
              <p className="limits">
                Contract limits: at most {vault.spCapBps / 100}% in the Stability Pool, at least {vault.minIdleBps / 100}% ready for
                withdrawals. {vault.paused ? "Trading is paused; withdrawals still work." : ""}
              </p>
            )}
          </section>

          <section className="card grey position-card" aria-label="Your position">
            <h2>Your MUSD</h2>
            {!me ? (
              <>
                <p className="muted">Connect a wallet on Mezo testnet to deposit. Borrow test MUSD at testnet.mezo.org.</p>
                <button className="cta" onClick={connect}><span>Connect wallet</span></button>
              </>
            ) : (
              <>
                <dl className="stats two">
                  <div><dt>In your wallet</dt><dd>{fmt(me.musd)}</dd></div>
                  <div><dt>In Tiller</dt><dd>{fmt(me.value)}</dd></div>
                </dl>
                <label className="field">
                  <span>Amount of MUSD</span>
                  <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </label>
                <div className="actions">
                  <button className="cta" onClick={() => send("deposit")} disabled={vault?.paused}><span>Deposit</span></button>
                  <button className="cta ghost" onClick={() => send("withdraw")}><span>Withdraw</span></button>
                </div>
              </>
            )}
            {status && <p className="status" role="status">{status}</p>}
          </section>
        </div>
      )}

      {VAULT && (
        <section className="log" id="log" aria-label="Decisions">
          <div className="section-head row">
            <div>
              <h2>Decision log</h2>
              <p>A bot proposes each move; Claude reviews it and can stop it. Every reason is on-chain.</p>
            </div>
            <CtaLink href="/" ghost>How it works</CtaLink>
          </div>
          {feed.length === 0 ? (
            <p className="empty">No decisions yet. The first one appears after the keeper's next run.</p>
          ) : (
            <ol className="entries">
              {feed.map((d) => (
                <li key={d.tx + d.action} className={`entry ${d.action === "NOTE" ? "held" : ""}`}>
                  <div className="entry-head">
                    <strong>{ACTION_TEXT[d.action] ?? d.action}</strong>
                    {d.action === "PEG_ARB" && <span className="gain">+{fmt(d.result, 3)} MUSD</span>}
                    {d.action === "HARVEST" && <span className="gain">{fmt(d.amount, 6)} BTC to {fmt(d.result, 2)} MUSD</span>}
                    {(d.action === "SP_DEPOSIT" || d.action === "SP_WITHDRAW") && <span className="amt">{fmt(d.amount, 2)} MUSD</span>}
                    {d.earlier && <span className="earlier">earlier vault version</span>}
                  </div>
                  <p>{d.why}</p>
                  <a href={`${EXPLORER}/tx/${d.tx}`} target="_blank" rel="noreferrer">
                    {d.time ? new Date(d.time * 1000).toLocaleString() : "View"} on the explorer
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <footer className="footer slim">
        <p className="disclaimer">Mezo testnet. Unaudited hackathon contracts. MUSD is Mezo's Bitcoin-backed dollar.</p>
      </footer>
    </div>
  );
}
