import { useState } from "react";
import { daysSince, num, useStats, type Defender } from "../traction";
import { Address, Card, Go, ago, type PageProps } from "./parts";

const PAGE_URL = "https://tillerfinance.xyz/app/leaderboard";

export function Leaderboard({ wallet }: PageProps) {
  const { stats, error } = useStats();
  const me = wallet.address?.toLowerCase();
  const board = stats?.leaderboard ?? [];
  const myIndex = board.findIndex((d) => d.address.toLowerCase() === me);

  return (
    <>
      <div className="grid-2 lb-top">
        <Card title="Your defender card">
          {!wallet.address ? (
            <div className="empty-state">
              <p>Connect a wallet to see your rank and get a card to share.</p>
              <button className="abtn" onClick={() => wallet.connect().catch(() => {})}>Connect wallet</button>
            </div>
          ) : !stats ? (
            <span className="skel" style={{ height: 120 }} />
          ) : myIndex < 0 ? (
            <div className="empty-state">
              <p>You're not on the board yet. Deposit any amount of MUSD to join the Peg Defenders.</p>
              <Go to="/app/earn" className="abtn">Deposit MUSD</Go>
            </div>
          ) : (
            <DefenderCard d={board[myIndex]} rank={myIndex + 1} total={board.length} />
          )}
        </Card>
        <Card title="What a Peg Defender does" className="soft">
          <ol className="how">
            <li><strong>Deposits MUSD into Tiller.</strong> The vault stands ready to buy MUSD back whenever it slips under $1.</li>
            <li><strong>Earns from defending the peg</strong> and from Mezo's Stability Pool, with Claude checking every move.</li>
            <li><strong>Ranks by MUSD defending right now.</strong> Read straight from the vault on Mezo testnet.</li>
          </ol>
          <p className="hint">New to Mezo testnet? <Go to="/app/earn" className="link">Get 100 test MUSD free →</Go></p>
        </Card>
      </div>

      <Card title="Peg Defenders" action={<span className="muted small">{stats ? `Updated ${ago(Math.round(stats.updatedAt / 1000))}` : ""}</span>}>
        {error && !stats ? <p className="muted">The leaderboard is unavailable right now ({error}). Try again in a minute.</p>
          : !stats ? <div className="skel-list"><span className="skel" /><span className="skel" /><span className="skel" /></div>
          : board.length === 0 ? <p className="muted">No defenders yet. <Go to="/app/earn" className="link">Be the first →</Go></p> : (
          <div className="table lb">
            <div className="tr th"><span>#</span><span>Defender</span><span>Defending</span><span>Deposited</span><span>Since</span></div>
            {board.map((d, i) => (
              <div key={d.address} className={`tr${i === myIndex ? " me" : ""}`}>
                <span className="rank">{i + 1}</span>
                <span><Address value={d.address} />{i === myIndex && <span className="you">You</span>}</span>
                <span className="num">{num(d.balanceMusd)} MUSD</span>
                <span className="num muted">{num(d.depositedMusd)}</span>
                <span className="muted">{ago(d.firstDeposit)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function DefenderCard({ d, rank, total }: { d: Defender; rank: number; total: number }) {
  const [copied, setCopied] = useState(false);
  const days = daysSince(d.firstDeposit);
  const text = `I'm defending MUSD's $1 peg on @MezoNetwork with Tiller Finance: rank #${rank}, ${num(d.balanceMusd, 0)} MUSD. Bitcoin-backed dollars that buy themselves back.`;
  return (
    <div className="defender">
      <div className="dcard" role="img" aria-label={`Peg Defender rank ${rank} of ${total}, defending ${num(d.balanceMusd)} MUSD for ${days} days`}>
        <div className="dcard-top">
          <span className="dcard-brand">Tiller</span>
          <img src="/brand/mezo-logo-light.svg" alt="" />
        </div>
        <span className="dcard-kicker">Peg Defender</span>
        <strong className="dcard-rank">#{rank}<small> of {total}</small></strong>
        <div className="dcard-stats">
          <div><span>Defending</span><strong>{num(d.balanceMusd)} <small>MUSD</small></strong></div>
          <div><span>Days on watch</span><strong>{days}</strong></div>
        </div>
        <code className="dcard-addr">{d.address.slice(0, 6)}…{d.address.slice(-4)}</code>
      </div>
      <div className="row-actions">
        <a className="abtn" target="_blank" rel="noreferrer"
          href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PAGE_URL)}`}>Share on X</a>
        <button className="abtn ghost" onClick={() => navigator.clipboard?.writeText(PAGE_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
