import { useState } from "react";
import { formatEther, maxUint256, parseEther, type Abi } from "viem";
import { MUSD, VAULT, erc20Abi, fmt, vaultAbi } from "../chain";
import { Address, Card, Go, Pill, type PageProps } from "./parts";
import { useToast } from "./toast";

type Tab = "deposit" | "withdraw";

function parseAmount(s: string): bigint | null {
  if (!s.trim()) return 0n;
  try {
    const v = parseEther(s.trim() as `${number}`);
    return v >= 0n ? v : null;
  } catch {
    return null;
  }
}

export function Earn({ live, wallet }: PageProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(new URLSearchParams(location.search).get("tab") === "withdraw" ? "withdraw" : "deposit");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { vault } = live;
  const a = wallet.account;
  const amount = parseAmount(input);
  const available = tab === "deposit" ? a?.musd : a?.maxWithdraw;
  const sharePrice = vault?.sharePrice ?? 10n ** 18n;
  const shares = amount ? (amount * 10n ** 18n) / (sharePrice || 1n) : 0n;
  const needsApproval = tab === "deposit" && !!a && !!amount && a.allowance < amount;

  const switchTab = (t: Tab) => {
    setTab(t);
    setInput("");
    history.replaceState(null, "", t === "withdraw" ? "/app/earn?tab=withdraw" : "/app/earn");
  };

  async function run(title: string, call: { address: `0x${string}`; abi: Abi; functionName: string; args: unknown[] }, done: string) {
    setBusy(true);
    const id = toast({ kind: "pending", title, body: "Confirm in your wallet, then wait for Mezo." });
    try {
      const hash = await wallet.send(call);
      toast({ kind: "success", title: done, tx: hash }, id);
      return true;
    } catch (e: any) {
      const rejected = /reject|denied/i.test(e.shortMessage ?? e.message ?? "");
      toast({ kind: "error", title: rejected ? "Cancelled in your wallet" : "Transaction failed", body: rejected ? undefined : e.shortMessage ?? e.message, tx: e.hash }, id);
      return false;
    } finally {
      setBusy(false);
      await Promise.all([wallet.refresh(), live.reload()]).catch(() => {});
    }
  }

  async function primary() {
    if (!wallet.address) return wallet.connect().catch((e) => toast({ kind: "error", title: "Couldn't connect", body: e.message }));
    if (wallet.wrongNetwork) return wallet.switchNetwork();
    if (!VAULT || !amount) return;
    if (needsApproval) {
      await run("Approving MUSD", { address: MUSD, abi: erc20Abi as Abi, functionName: "approve", args: [VAULT, maxUint256] }, "MUSD approved");
      return;
    }
    const ok = tab === "deposit"
      ? await run(`Depositing ${input} MUSD`, { address: VAULT, abi: vaultAbi as Abi, functionName: "deposit", args: [amount, wallet.address] }, `Deposited ${input} MUSD`)
      : await run(`Withdrawing ${input} MUSD`, { address: VAULT, abi: vaultAbi as Abi, functionName: "withdraw", args: [amount, wallet.address, wallet.address] }, `Withdrew ${input} MUSD`);
    if (ok) setInput("");
  }

  // the button always says the one thing to do next
  let label = tab === "deposit" ? `Deposit ${input || ""} MUSD`.replace("  ", " ") : `Withdraw ${input || ""} MUSD`.replace("  ", " ");
  let disabled = busy;
  if (!wallet.hasWallet) { label = "Install a browser wallet"; disabled = true; }
  else if (!wallet.address) label = "Connect wallet";
  else if (wallet.wrongNetwork) label = "Switch to Mezo Testnet";
  else if (tab === "deposit" && vault?.paused) { label = "Deposits are paused"; disabled = true; }
  else if (amount === null) { label = "Enter a valid amount"; disabled = true; }
  else if (!amount) { label = "Enter an amount"; disabled = true; }
  else if (available !== undefined && amount > available) { label = tab === "deposit" ? "Not enough MUSD in your wallet" : "More than you can withdraw now"; disabled = true; }
  else if (needsApproval) label = "Approve MUSD";
  if (busy) label = "Waiting for confirmation…";

  return (
    <div className="earn">
      <Card className="action-card">
        <div className="tabs" role="tablist">
          {(["deposit", "withdraw"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => switchTab(t)}>
              {t === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          ))}
        </div>

        <div className="amount-box">
          <div className="amount-top">
            <span>{tab === "deposit" ? "You deposit" : "You withdraw"}</span>
            {a && <button className="max" onClick={() => setInput(formatEther(available ?? 0n))}>Max {fmt(available)}</button>}
          </div>
          <div className="amount-row">
            <input inputMode="decimal" placeholder="0.00" value={input} aria-label="Amount of MUSD"
              onChange={(e) => setInput(e.target.value.replace(",", "."))} />
            <span className="token"><img src="/brand/musd.svg" alt="" />MUSD</span>
          </div>
          <span className="amount-sub">
            {a ? (tab === "deposit" ? `Wallet balance ${fmt(a.musd)} MUSD` : `Available ${fmt(a.maxWithdraw)} MUSD`) : "Connect a wallet to see your balance"}
          </span>
        </div>

        <dl className="preview">
          <div><dt>{tab === "deposit" ? "You receive" : "Shares burned"}</dt><dd>{amount ? fmt(shares, 4) : "0.0000"} tMUSD</dd></div>
          <div><dt>Value of 1 tMUSD</dt><dd>{fmt(vault?.sharePrice, 4)} MUSD</dd></div>
          <div><dt>Vault fee</dt><dd>None</dd></div>
          <div><dt>Network fee</dt><dd>Under 0.0001 BTC</dd></div>
        </dl>

        {tab === "deposit" && a && amount ? (
          <ol className="steps-mini" aria-label="Steps">
            <li className={needsApproval ? "now" : "done"}><b>{needsApproval ? 1 : "✓"}</b>Approve MUSD</li>
            <li className={needsApproval ? "" : "now"}><b>2</b>Deposit</li>
          </ol>
        ) : null}

        <button className="abtn wide" disabled={disabled} onClick={primary}>{label}</button>
        {tab === "withdraw" && <p className="hint">Withdrawals never pause. Large ones are pulled from the Stability Pool automatically.</p>}
        {wallet.address && a && a.musd === 0n && tab === "deposit" && (
          <p className="hint">No MUSD yet? Borrow test MUSD against test BTC at <a href="https://testnet.mezo.org" target="_blank" rel="noreferrer">testnet.mezo.org</a>.</p>
        )}
      </Card>

      <div className="earn-side">
        <Card title="MUSD Peg Vault">
          <div className="vault-id">
            <img src="/brand/musd.svg" alt="" />
            <div>
              <strong>tMUSD</strong>
              <span>ERC-4626 vault on Mezo Testnet</span>
            </div>
            <Pill tone={vault?.paused ? "warn" : "good"}>{vault?.paused ? "Paused" : "Active"}</Pill>
          </div>
          <dl className="kv">
            <div><dt>Total deposits</dt><dd>{fmt(vault?.total)} MUSD</dd></div>
            <div><dt>Earns from</dt><dd>Peg trades and Stability Pool liquidations</dd></div>
            <div><dt>Yield</dt><dd>Variable. It comes when MUSD dips or loans are liquidated</dd></div>
            <div><dt>Max in Stability Pool</dt><dd>{vault ? vault.spCapBps / 100 : "–"}%</dd></div>
            <div><dt>Always kept ready</dt><dd>{vault ? vault.minIdleBps / 100 : "–"}% of deposits</dd></div>
            <div><dt>Contract</dt><dd>{VAULT && <Address value={VAULT} />}</dd></div>
          </dl>
        </Card>
        <Card title="How it earns" className="soft">
          <ol className="how">
            <li><strong>MUSD dips under $1.</strong> The vault redeems MUSD with Mezo for $1 of BTC and sells it back for more MUSD.</li>
            <li><strong>A loan gets liquidated.</strong> The Stability Pool receives the borrower's BTC at a discount, and the vault sells it for MUSD.</li>
            <li><strong>Claude checks every move</strong> and the contract refuses any trade that would lose money.</li>
          </ol>
          <Go to="/app/peg" className="link">See live MUSD prices →</Go>
        </Card>
        <p className="risk-note">Testnet only. Unaudited code; don't use real funds.</p>
      </div>
    </div>
  );
}
