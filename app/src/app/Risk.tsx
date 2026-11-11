import { DRILL_POOL, KEEPER, MEZO_CONTRACTS, TIMELOCK, VAULT, fmt } from "../chain";
import { GITHUB } from "../proof";
import { Address, Card, Pill, type PageProps } from "./parts";

export function Risk({ live }: PageProps) {
  const v = live.vault;
  const rules = [
    { name: "Stability Pool cap", value: v ? `${v.spCapBps / 100}%` : "–", body: "The most of the vault that can sit in Mezo's Stability Pool. Checked after every deposit into it." },
    { name: "Ready cash floor", value: v ? `${v.minIdleBps / 100}%` : "–", body: "Always kept as plain MUSD so withdrawals and peg trades never wait." },
    { name: "Max BTC sale slippage", value: v ? `${v.maxSlippageBps / 100}%` : "–", body: "BTC is never sold for less than Mezo's oracle price minus this." },
    { name: "Peg trades must profit", value: "Enforced", body: "A peg trade reverts unless the vault ends with more MUSD than it started with." },
    { name: "Sell MUSD only above", value: v ? `$${(1 + v.minPremiumBps / 10_000).toFixed(3)}` : "–", body: "MUSD is sold for mUSDC only at a premium, adding MUSD where it's scarce." },
    { name: "Buy MUSD back only at", value: "$1.00 or less", body: "mUSDC is spent on MUSD only at $1 or cheaper, so the round trip can't lose." },
    { name: "mUSDC cap", value: v ? `${v.stableCapBps / 100}%` : "–", body: "The most of the vault that can be held as mUSDC. Withdrawals are paid from the rest." },
    { name: "Deposit cap", value: v ? `${fmt(v.cap, 0)} MUSD` : "–", body: "Total deposits allowed for now, raised as the vault proves itself." },
    { name: "Approved pools only", value: "Whitelist", body: "Swaps only through Mezo pools the admin has approved." },
    { name: "Withdrawals", value: v?.paused ? "Open (trading paused)" : "Always open", body: "Pausing stops deposits and trades. It can never block a withdrawal." },
  ];

  return (
    <>
      <div className="grid-2">
        <Card title="Hard limits in the contract">
          <ul className="rules">
            {rules.map((r) => (
              <li key={r.name}>
                <div><strong>{r.name}</strong><p>{r.body}</p></div>
                <span className="rule-value">{r.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="stack">
          <Card title="Who can do what">
            <dl className="kv">
              <div><dt>Keeper bot</dt><dd>{KEEPER && <Address value={KEEPER} />}<span className="kv-note">Proposes moves within the limits</span></dd></div>
              <div><dt>Claude</dt><dd>Veto only<span className="kv-note">Can stop a move, never start one. If unreachable, nothing moves</span></dd></div>
              <div><dt>Guardian</dt><dd>Can pause trading<span className="kv-note">Can't touch withdrawals; can turn mUSDC back into MUSD</span></dd></div>
              <div><dt>Admin</dt><dd>{TIMELOCK ? <Address value={TIMELOCK} /> : "Timelock"}<span className="kv-note">Limit and pool changes wait in a public timelock first</span></dd></div>
              <div><dt>Depositors</dt><dd>Withdraw any time</dd></div>
            </dl>
          </Card>
          <Card title="Status" className="soft">
            <div className="status-list">
              <div><span>Network</span><Pill tone="info">Mezo Testnet</Pill></div>
              <div><span>Audit</span><Pill tone="warn">Not audited</Pill></div>
              <div><span>Trading</span><Pill tone={v?.paused ? "warn" : "good"}>{v?.paused ? "Paused" : "Active"}</Pill></div>
              <div><span>Source code</span><a href={GITHUB} target="_blank" rel="noreferrer" className="link">GitHub →</a></div>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Contracts">
        <div className="table contracts">
          <div className="tr th"><span>Contract</span><span>Address</span><span>Role</span></div>
          {VAULT && <div className="tr"><strong>Tiller Vault (tMUSD)</strong><Address value={VAULT} /><span className="muted">Holds deposits, enforces limits</span></div>}
          {TIMELOCK && <div className="tr"><strong>Timelock</strong><Address value={TIMELOCK} /><span className="muted">Vault admin; changes wait before they run</span></div>}
          {DRILL_POOL && <div className="tr"><strong>Depeg drill pool</strong><Address value={DRILL_POOL} /><span className="muted">Wave 1 rehearsal pool; not used by the current vault</span></div>}
          {MEZO_CONTRACTS.map((c) => (
            <div className="tr" key={c.address}><strong>{c.name}</strong><Address value={c.address} /><span className="muted">Mezo</span></div>
          ))}
        </div>
      </Card>
    </>
  );
}
