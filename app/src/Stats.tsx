import { useEffect, useState } from "react";
import { EXPLORER } from "./chain";
import { GITHUB, TELEGRAM } from "./proof";
import { num, useStats, type Stats as S } from "./traction";
import { CtaLink, Logo } from "./ui";

/** Public traction page at /stats: every number comes from the vault's events on Mezo testnet. */
export default function Stats() {
  const { stats, error } = useStats();
  useEffect(() => { document.title = "Live stats · Tiller Finance"; }, []);
  const tiles: [string, string | undefined, string][] = [
    ["Peg Defenders", stats && num(stats.depositors, 0), "Unique wallets that deposited"],
    ["Deposits", stats && num(stats.deposits, 0), stats ? `${num(stats.withdrawals, 0)} withdrawals` : ""],
    ["Value locked", stats && num(stats.tvlMusd), "MUSD in the vault now"],
    ["Value of 1 tMUSD", stats && num(stats.sharePrice, 4), "MUSD, rises as the vault earns"],
    ["Peg trades", stats && num(stats.pegTrades, 0), stats ? `+${num(stats.pegProfitMusd, 3)} MUSD profit` : ""],
    ["Claude decisions", stats && num(stats.decisions, 0), "Every move, with its reason on-chain"],
    ["Faucet claims", stats && num(stats.faucetClaims, 0), "Wallets given 100 test MUSD"],
    ["Telegram users", stats && num(stats.botUsers, 0), "People talking to @tillerfinancebot"],
  ];

  return (
    <div className="site stats-page">
      <header className="nav">
        <Logo />
        <nav aria-label="Sections">
          <a href="/">About</a>
          <a href="/app/leaderboard">Leaderboard</a>
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          <a href={TELEGRAM} target="_blank" rel="noreferrer">Telegram</a>
        </nav>
        <CtaLink href="/app">Launch app</CtaLink>
      </header>

      <section className="sp-head">
        <h1>Tiller, live</h1>
        <p>
          Read straight from the vault on Mezo testnet. {(stats || !error) && <Updated at={stats?.updatedAt} />}
          {stats && <> · <a href={`${EXPLORER}/address/${stats.vault}`} target="_blank" rel="noreferrer">Vault on the explorer</a></>}
        </p>
        {error && <p className="sp-error" role="alert">{stats ? "Showing the last numbers we read; " : ""}the stats API is unreachable right now ({error}).</p>}
      </section>

      <section className="sp-tiles" aria-label="Headline numbers">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="sp-tile">
            <span>{label}</span>
            {value !== undefined ? <strong>{value}</strong> : error ? <strong className="muted">–</strong> : <i className="skel" />}
            <small>{sub}</small>
          </div>
        ))}
      </section>

      <section className="sp-chart">
        <h2>Value locked over time</h2>
        <p className="muted">MUSD in the vault after every deposit and withdrawal.</p>
        {stats && stats.tvlSeries.length > 1 ? <TvlChart series={stats.tvlSeries} /> : <p className="muted">{stats ? "Not enough history yet." : error ? "Unavailable right now." : "Loading…"}</p>}
      </section>

      <footer className="sp-foot">
        <p>Testnet figures, unaudited contracts. {stats ? `Block ${num(stats.block, 0)}.` : ""}</p>
        <CtaLink href="/app/earn">Get 100 test MUSD and join</CtaLink>
      </footer>
    </div>
  );
}

function Updated({ at }: { at?: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  if (!at) return <>Loading…</>;
  return <>Updated {Math.max(0, Math.round((Date.now() - at) / 1000))} seconds ago.</>;
}

const W = 800, H = 260, PAD = { l: 56, r: 16, t: 16, b: 32 };

/** Step line: value holds between events. Crosshair + tooltip on hover; a table view for screen readers. */
function TvlChart({ series }: { series: S["tvlSeries"] }) {
  const [hover, setHover] = useState<number>();
  const pts = [...series, { t: Math.round(Date.now() / 1000), tvl: series[series.length - 1].tvl }];
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const max = Math.max(...pts.map((p) => p.tvl)) * 1.1 || 1;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const d = pts.map((p, i) => (i === 0 ? `M${x(p.t)},${y(p.tvl)}` : `H${x(p.t)}V${y(p.tvl)}`)).join("");
  const ticks = [0, max / 2, max];
  const date = (t: number) => new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const h = hover === undefined ? undefined : series[hover];

  return (
    <div className="tvl-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Value locked, from ${num(series[0].tvl)} to ${num(series[series.length - 1].tvl)} MUSD`}
        onMouseLeave={() => setHover(undefined)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const t = t0 + (((e.clientX - r.left) / r.width) * W - PAD.l) / (W - PAD.l - PAD.r) * (t1 - t0);
          let i = 0;
          while (i + 1 < series.length && series[i + 1].t <= t) i++;
          setHover(i);
        }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="axis-label">{num(v, 0)}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} className="axis-label">{date(t0)}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="axis-label">Now</text>
        <path d={`${d}V${y(0)}H${x(t0)}Z`} className="area" />
        <path d={d} className="line" />
        {h && (
          <g>
            <line x1={x(h.t)} x2={x(h.t)} y1={PAD.t} y2={H - PAD.b} className="cross" />
            <circle cx={x(h.t)} cy={y(h.tvl)} r="5" className="dot" />
          </g>
        )}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(x(h.t) / W) * 100}%` }}>
          <strong>{num(h.tvl)} MUSD</strong><span>{date(h.t)}</span>
        </div>
      )}
      <details className="tvl-table">
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th>Time</th><th>Value locked (MUSD)</th></tr></thead>
          <tbody>{series.map((p) => <tr key={p.t + ":" + p.tvl}><td>{date(p.t)}</td><td>{num(p.tvl)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
