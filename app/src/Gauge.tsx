import { ARB_LINE, type Pool } from "./live";

const MIN = 0.94, MAX = 1.06;
const x = (p: number) => ((Math.min(MAX, Math.max(MIN, p)) - MIN) / (MAX - MIN)) * 1000;

/** MUSD price per pool against the $1 line, with the zone where buying MUSD back pays. */
export function PegGauge({ pools }: { pools: Pool[] }) {
  const ticks = [0.94, 0.96, 0.98, 1, 1.02, 1.04, 1.06];
  return (
    <svg className="gauge" viewBox="0 0 1000 200" role="img"
      aria-label={pools.map((p) => `${p.label}: $${p.musdUsd.toFixed(4)}`).join("; ") || "Loading prices"}>
      <rect x="0" y="44" width={x(ARB_LINE)} height="92" rx="14" className="zone" />
      <line x1={x(ARB_LINE)} x2={x(ARB_LINE)} y1="38" y2="142" className="arb-line" />
      <text x={x(ARB_LINE) - 12} y="32" textAnchor="end" className="zone-label">Vault buys MUSD back</text>
      <line x1={x(1)} x2={x(1)} y1="22" y2="150" className="peg-line" />
      <text x={x(1)} y="14" textAnchor="middle" className="peg-label">$1.00</text>
      <line x1="0" x2="1000" y1="142" y2="142" className="axis" />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y="172" textAnchor={t === MIN ? "start" : t === MAX ? "end" : "middle"} className="tick-label">
          {t.toFixed(2)}
        </text>
      ))}
      {pools.map((p, i) => {
        const cx = x(p.musdUsd);
        const y = 74 + i * 38;
        const right = cx > 760;
        return (
          <g key={p.label} className={p.musdUsd < 1 ? "buoy below" : "buoy above"}>
            <line x1={cx} x2={cx} y1={y} y2="142" className="mooring" />
            <circle cx={cx} cy={y} r="11" />
            <text x={cx + (right ? -20 : 20)} y={y + 5} textAnchor={right ? "end" : "start"}>
              {p.label} · ${p.musdUsd.toFixed(4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
