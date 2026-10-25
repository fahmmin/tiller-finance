import { fmt } from "../chain";
import { ACTION_TEXT } from "../live";
import { Card, Go, Pill, Stat, ago, pegStatus, type PageProps } from "./parts";

export function Overview({ live, wallet }: PageProps) {
  const { vault, pools, feed } = live;
  const total = vault ? Number(vault.total) / 1e18 : undefined;
  const idlePct = vault && vault.total > 0n ? (Number(vault.idle) / Number(vault.total)) * 100 : undefined;
  const pegProfit = feed?.filter((d) => d.action === "PEG_ARB").reduce((s, d) => s + Number(d.result) / 1e18, 0);
  const mezoPool = pools.find((p) => p.label.startsWith("Mezo"));
  const status = pegStatus(mezoPool?.musdUsd);
  const a = wallet.account;

  return (
    <>
      <div className="stats-row">
        <Stat label="Total deposits" value={total?.toLocaleString("en-US", { maximumFractionDigits: 2 })} unit="MUSD" sub="Mezo testnet vault" />
        <Stat label="Value of 1 tMUSD" value={vault ? fmt(vault.sharePrice, 4) : undefined} unit="MUSD" sub="Rises as the vault earns" />
        <Stat label="Peg-trade profit" value={pegProfit === undefined ? undefined : `+${pegProfit.toFixed(3)}`} unit="MUSD" sub="All vault versions" />
        <Stat label="MUSD on Mezo Pools" value={mezoPool ? `$${mezoPool.musdUsd.toFixed(4)}` : undefined} sub={<Pill tone={status.tone}>{status.text}</Pill>} />
      </div>

      <div className="grid-2">
        <Card title="Your position" action={<Go to="/app/earn" className="link">Manage →</Go>}>
          {!wallet.address ? (
            <div className="empty-state">
              <p>Connect a wallet to see your deposit and start earning on MUSD.</p>
              <button className="abtn" onClick={() => wallet.connect().catch(() => {})}>Connect wallet</button>
            </div>
          ) : (
            <>
              <div className="position">
                <Stat label="Your deposit" value={a ? fmt(a.value) : undefined} unit="MUSD" loading={!a} />
                <Stat label="Vault shares" value={a ? fmt(a.shares, 4) : undefined} unit="tMUSD" loading={!a} />
                <Stat label="In your wallet" value={a ? fmt(a.musd) : undefined} unit="MUSD" loading={!a} />
              </div>
              <div className="row-actions">
                <Go to="/app/earn" className="abtn">Deposit</Go>
                <Go to="/app/earn?tab=withdraw" className="abtn ghost">Withdraw</Go>
              </div>
            </>
          )}
        </Card>

        <Card title="Where the money is" action={<Go to="/app/risk" className="link">Limits →</Go>}>
          {idlePct === undefined ? <span className="skel" style={{ height: 56 }} /> : (
            <>
              <div className="alloc small" role="img" aria-label={`Stability Pool ${(100 - idlePct).toFixed(0)}%, ready cash ${idlePct.toFixed(0)}%`}>
                <div className="alloc-seg seg-sp" style={{ width: `${100 - idlePct}%` }}><span>{(100 - idlePct).toFixed(0)}%</span></div>
                <div className="alloc-seg seg-idle" style={{ width: `${idlePct}%` }}><span>{idlePct.toFixed(0)}%</span></div>
              </div>
              <ul className="legend compact">
                <li><i className="seg-sp" /><div><strong>Stability Pool · {fmt(vault!.total - vault!.idle)} MUSD</strong><span>Earns when Mezo closes risky loans</span></div></li>
                <li><i className="seg-idle" /><div><strong>Ready cash · {fmt(vault!.idle)} MUSD</strong><span>Instant withdrawals and peg trades</span></div></li>
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Recent decisions" action={<Go to="/app/activity" className="link">All activity →</Go>}>
        {!feed ? <div className="skel-list"><span className="skel" /><span className="skel" /><span className="skel" /></div>
          : feed.length === 0 ? <p className="muted">No decisions yet.</p> : (
          <ul className="mini-feed">
            {feed.slice(0, 4).map((d) => (
              <li key={d.tx + d.action}>
                <span className={`dot-badge ${d.action}`} />
                <div>
                  <strong>{ACTION_TEXT[d.action] ?? d.action}</strong>
                  <p>{d.why}</p>
                </div>
                <span className="when">{ago(d.time)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
