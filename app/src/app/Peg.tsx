import { PegGauge } from "../Gauge";
import { ARB_LINE } from "../live";
import { Address, Card, Pill, Stat, pegStatus, type PageProps } from "./parts";

export function Peg({ live }: PageProps) {
  const { pools, btcUsd, tcr } = live;
  const recovery = tcr !== undefined && tcr < 1.5;
  return (
    <>
      <div className="stats-row">
        <Stat label="BTC price (Mezo oracle)" value={btcUsd?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} sub="Updates every block" />
        <Stat label="Mezo system collateral" value={tcr === undefined ? undefined : `${(tcr * 100).toFixed(0)}%`}
          sub={<Pill tone={recovery ? "bad" : "good"}>{recovery ? "Recovery Mode" : "Healthy, above 150%"}</Pill>} />
        <Stat label="Redemption fee" value="0.75%" sub="Paid to Mezo on each redemption" />
        <Stat label="Buyback line" value={`$${ARB_LINE.toFixed(4)}`} sub="Below this, peg trades pay" />
      </div>

      <Card title="MUSD price by pool" action={<span className="muted small">Refreshes every 20 seconds</span>}>
        <PegGauge pools={pools} />
      </Card>

      <Card title="Pools the vault can trade on">
        <div className="table">
          <div className="tr th"><span>Pool</span><span>MUSD price</span><span>Distance from $1</span><span>Status</span></div>
          {pools.length === 0 ? <div className="tr"><span className="skel" /></div> : pools.map((p) => {
            const s = pegStatus(p.musdUsd);
            const dev = (p.musdUsd - 1) * 100;
            return (
              <div className="tr" key={p.address}>
                <span className="pool-name"><img src="/brand/musd.svg" alt="" /><span>{p.label}<Address value={p.address} /></span></span>
                <span className="num">${p.musdUsd.toFixed(4)}</span>
                <span className={`num ${dev < 0 ? "neg" : "pos"}`}>{dev >= 0 ? "+" : ""}{dev.toFixed(2)}%</span>
                <span><Pill tone={s.tone}>{s.text}</Pill></span>
              </div>
            );
          })}
        </div>
        <p className="hint">The drill pool is a Tiller-run testnet pool seeded under $1, because MUSD on Mezo testnet trades above $1.</p>
      </Card>
    </>
  );
}
