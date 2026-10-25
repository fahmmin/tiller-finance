import { useState } from "react";
import { EXPLORER, VAULT, fmt } from "./chain";
import { PegGauge } from "./Gauge";
import { useLive } from "./live";
import { GITHUB, PROOF } from "./proof";
import { CtaLink, Logo, Tag } from "./ui";

const PARTS = [
  {
    name: "Peg trades",
    body: "When MUSD trades under $1, the vault redeems MUSD with Mezo for $1 of BTC, sells that BTC back where MUSD is cheap, and keeps the difference. The contract reverts any trade that doesn't end with more MUSD.",
    stat: `+${PROOF.pegTrade.returnPct}%`,
    statLabel: "on the first live trade",
  },
  {
    name: "Stability Pool",
    body: "Between depegs, up to 80% of deposits back Mezo's Stability Pool. When a loan is liquidated, the vault absorbs it for BTC at a discount, then sells that BTC back to MUSD.",
    stat: `${PROOF.stabilityPool.amount} MUSD`,
    statLabel: "deployed on testnet",
  },
  {
    name: "Claude review",
    body: "A rule-based keeper proposes each move. Claude reads the same numbers and approves or stops it, then writes the reason on-chain in plain English. If Claude can't be reached, nothing moves.",
    stat: "Veto only",
    statLabel: "the AI can make the vault do less, never more",
  },
  {
    name: "Hard limits",
    body: "Whitelisted pools only. BTC never sold more than 1.5% under Mezo's oracle. At least 10% kept ready for withdrawals. A guardian can pause trading, and pausing never blocks withdrawals.",
    stat: "6",
    statLabel: "guardrails enforced in the contract",
  },
];

const STEPS = [
  { name: "Read", body: "The keeper reads Mezo every few minutes: BTC price, system collateral, every pool's MUSD price, the vault's balances." },
  { name: "Review", body: "It plans with fixed rules. Claude checks the plan against the numbers and approves it or stops it, with a reason." },
  { name: "Execute", body: "Approved moves are simulated first, then sent. The contract re-checks every limit and records the reason on-chain." },
];

const LESSONS = [
  {
    topic: "Redemptions",
    title: "Compute redemption hints in the same transaction",
    body: "Mezo's oracle moves every block, so a hint from 12 seconds earlier gets the partial redemption cancelled.",
  },
  {
    topic: "Hint helper",
    title: "getRedemptionHints doesn't account for minimum debt",
    body: "It quoted 18.75 MUSD as redeemable from a trove only 3.18 MUSD above the 1,800 floor.",
  },
  {
    topic: "Peg health",
    title: "One trove at the minimum can block small redemptions",
    body: "Redemptions stop at the first cancelled partial, so a queue head at exactly 1,800 MUSD freezes small arbitrage.",
  },
];

export default function Landing() {
  const { vault, pools } = useLive();
  const [open, setOpen] = useState(0);
  const live = pools.find((p) => p.label.startsWith("Mezo"));

  return (
    <div className="site">
      <header className="nav">
        <Logo />
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#proof">Proof</a>
          <a href="#safety">Safety</a>
          <a href="#roadmap">Roadmap</a>
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
        <CtaLink href="/app">Launch app</CtaLink>
      </header>

      <section className="hero">
        <Tag>Bitcoin-backed savings on Mezo</Tag>
        <h1 className="hero-title">
          <span className="w">What</span> <span className="w">if</span> <span className="w">your</span>{" "}
          <span className="chip w" aria-hidden="true"><b>$</b><em>›››</em></span>{" "}
          <span className="w">dollars</span> <br className="br-desk" />
          <span className="w">defended</span> <span className="w">their</span> <span className="w">own</span> <span className="w">peg?</span>
        </h1>
        <p className="hero-sub">
          <mark className="hl pink">Peg trades,</mark> <mark className="hl white">Stability Pool yield,</mark> and{" "}
          <mark className="hl black">AI risk review</mark> in one MUSD vault. Every move is bounded by code and explained on-chain.
        </p>
        <div className="hero-ctas">
          <CtaLink href="/app">Deposit MUSD</CtaLink>
          <CtaLink href="#proof" ghost>See the testnet results</CtaLink>
          <CtaLink href={GITHUB} ghost>Read the code</CtaLink>
        </div>
      </section>

      <section className="hero-cards" aria-label="Live market and first results">
        <article className="card light gauge-card">
          <div className="card-head">
            <h2>MUSD price, live</h2>
            <span className="live-dot">Mezo testnet</span>
          </div>
          <PegGauge pools={pools} />
          <p className="small muted">
            {live ? `Mezo's MUSD/BTC pool prices MUSD at $${live.musdUsd.toFixed(4)} right now. ` : ""}
            The drill pool is seeded under $1 on purpose, to rehearse a depeg.
          </p>
        </article>
        <article className="card teal stat-card">
          <div className="dots" aria-hidden="true">
            {Array.from({ length: 21 }, (_, i) => <i key={i} className={i < 11 ? "on" : ""} />)}
          </div>
          <div className="stat-row">
            <strong className="big">+{PROOF.pegTrade.returnPct}%</strong>
            <span>First live peg trade</span>
          </div>
          <hr />
          <p className="stat-claim">Built for the floor of a stablecoin, not the hype around it.</p>
          <div className="stat-row small-row">
            <span>Drill pool MUSD price after the trade</span>
            <strong className="pink-text">+{((PROOF.pegTrade.priceAfter / PROOF.pegTrade.priceBefore - 1) * 100).toFixed(1)}%</strong>
          </div>
          <div className="bars" aria-hidden="true">
            {[30, 24, 36, 42, 70, 82, 90, 40, 34, 46, 38, 30].map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i >= 4 && i <= 6 ? "hot" : ""} />)}
          </div>
        </article>
      </section>

      <section className="strip" aria-label="Built with">
        <p>Built on the Mezo stack, reviewed by Claude</p>
        <ul>
          <li className="wm-1">mezo</li>
          <li className="wm-2">MUSD</li>
          <li className="wm-3">Stability Pool</li>
          <li className="wm-4">Mezo Pools</li>
          <li className="wm-5">Claude</li>
          <li className="wm-6">Skip oracle</li>
        </ul>
      </section>

      <section className="dark-block pov" id="why">
        <Tag dark>Why this exists</Tag>
        <p className="statement">
          A stablecoin's floor is only as strong as the people willing to buy it back.{" "}
          <span className="lime-text">Tiller turns every MUSD holder into one of them</span>, with limits the code enforces and
          reasons anyone can read.
        </p>
        <div className="pov-foot">
          <div className="pov-badges" aria-hidden="true"><i>₿</i><i>$</i><i>AI</i><i>✓</i></div>
          <p>
            On Mezo mainnet, MUSD traded at ${PROOF.mainnetMusd} on Oct 25, 2026, right at the 0.75% redemption floor. That floor
            only holds if someone runs the trade. Today that's people with their own bots.
          </p>
        </div>

        <div className="parts" id="how">
          <div className="parts-list">
            <Tag dark>Four parts, one vault</Tag>
            <h2>Where does your MUSD work?</h2>
            <ol>
              {PARTS.map((p, i) => (
                <li key={p.name}>
                  <button className={open === i ? "open" : ""} onClick={() => setOpen(i)} aria-expanded={open === i}>
                    <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                    {p.name}
                  </button>
                  {open === i && <p>{p.body}</p>}
                </li>
              ))}
            </ol>
          </div>
          <div className="parts-panel">
            <span className="panel-kicker">{PARTS[open].name}</span>
            <strong>{PARTS[open].stat}</strong>
            <span>{PARTS[open].statLabel}</span>
          </div>
        </div>
      </section>

      <section className="proof" id="proof">
        <div className="section-head center">
          <h2>Tested on chain, not on slides.</h2>
          <p>Every figure here is a Mezo testnet transaction you can open. Run on Oct 25, 2026.</p>
        </div>
        <div className="bento">
          <a className="card yellow" href={PROOF.pegTrade.tx} target="_blank" rel="noreferrer">
            <span className="badge">Peg trade</span>
            <strong className="big">+{PROOF.pegTrade.profit} MUSD</strong>
            <p>Redeemed {PROOF.pegTrade.redeemed} MUSD for BTC through Mezo, sold it back in the drill pool. Claude approved first.</p>
          </a>
          <div className="card grey">
            <span className="badge light">Peg pressure</span>
            <strong className="big">${PROOF.pegTrade.priceBefore} → ${PROOF.pegTrade.priceAfter}</strong>
            <div className="bars grey-bars" aria-hidden="true">
              {[50, 50, 52, 51, 53, 70, 74, 54, 55, 56].map((h, i) => <i key={i} style={{ height: `${h}%` }} className={i === 5 || i === 6 ? "hot" : ""} />)}
            </div>
            <p>One trade lifted the drill pool's MUSD price by 0.7%. Buying back cheap MUSD is what holds the peg.</p>
          </div>
          <div className="card teal wide">
            <div className="wide-text">
              <span className="muted-light">Stability Pool, Claude approved</span>
              <strong className="big lime-text">{PROOF.stabilityPool.amount} MUSD</strong>
              <p>Moved into Mezo's Stability Pool with 20% kept liquid, exactly the 80% cap the contract enforces.</p>
              <CtaLink href={PROOF.stabilityPool.tx} light>View transaction</CtaLink>
            </div>
            <div className="wide-quote">
              <p>“The numbers don't add up. Redeeming 500 MUSD after the 0.75% fee gives about $496.25 of BTC. Even selling at $0.98 returns only about 506.4 MUSD, not the proposed 508.40.”</p>
              <span>Claude, vetoing a test plan with a wrong profit figure</span>
            </div>
          </div>
        </div>
      </section>

      <section className="numbers" aria-label="Key numbers">
        <Tag>The numbers behind the vault</Tag>
        <div className="numbers-row">
          <div><strong>{PROOF.tests}<sup>+</sup></strong><span>Automated tests passing</span></div>
          <div><strong>0<sup>/{PROOF.wave1Entries}</sup></strong><span>Other Wave 1 entries defending the peg</span></div>
          <div><strong>{vault ? fmt(vault.total, 0) : "300"}<sup>MUSD</sup></strong><span>In the live testnet vault</span></div>
        </div>
      </section>

      <section className="loop">
        <div className="card grey loop-left">
          <div className="loop-head">
            <h2>How a decision happens.</h2>
            <p>The same loop every run, with a reason written on-chain each time.</p>
          </div>
          <div className="loop-foot">
            <strong>3</strong>
            <span>checks before any MUSD moves: the rules, Claude, and the contract.</span>
          </div>
        </div>
        <div className="loop-right">
          <span className="loop-kicker">3 steps</span>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.name}>
                <span className="idx lime">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.name}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="dark-block versus" id="safety">
        <Tag dark>Why hold MUSD here</Tag>
        <h2 className="center">Same MUSD. Different math.</h2>
        <div className="vs">
          <div className="vs-head muted-head">Doing it yourself</div>
          <span className="vs-mid">VS</span>
          <div className="vs-head lime-head"><Logo /></div>
          <ul className="vs-list no">
            <li>Idle MUSD earns nothing between depegs</li>
            <li>Peg trades need your own bot, hints and timing</li>
            <li>Liquidation BTC sits unsold until you act</li>
            <li>No one checks a trade before it runs</li>
          </ul>
          <ul className="vs-list yes">
            <li>Stability Pool yield while MUSD is on peg</li>
            <li>Peg trades run for you, profit-checked on chain</li>
            <li>BTC sold back at no worse than oracle minus 1.5%</li>
            <li>Every move reviewed by Claude and logged with a reason</li>
          </ul>
        </div>
      </section>

      <section className="lessons">
        <div className="section-head row">
          <div>
            <h2>What we learned building on Mezo</h2>
            <p>Three findings from live redemptions, shared with the Mezo team.</p>
          </div>
          {GITHUB && <CtaLink href={GITHUB}>Read the code</CtaLink>}
        </div>
        <div className="lesson-grid">
          {LESSONS.map((l, i) => (
            <article key={l.title} className={`lesson ${i === 0 ? "feature" : ""}`}>
              <span className="badge light">{l.topic}</span>
              <h3>{l.title}</h3>
              <p>{l.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="roadmap" id="roadmap">
        <div className="section-head center">
          <Tag>Wave 2 and after</Tag>
          <h2>Where Tiller goes next.</h2>
        </div>
        <ol className="road">
          <li><span className="idx">Nov</span><h3>Mainnet, capped</h3><p>Deploy against Mezo's real MUSD/BTC and stable pools with a deposit cap.</p></li>
          <li><span className="idx">Nov</span><h3>More ways to earn</h3><p>sMUSD, MUSD/mUSDC liquidity with gauge rewards, and defending the peg above $1.</p></li>
          <li><span className="idx">Nov</span><h3>Ask Tiller on Telegram</h3><p>"Why did my vault do that?" answered from the on-chain log.</p></li>
          <li><span className="idx">Dec</span><h3>Ethereum and Base</h3><p>Curve and Aerodrome MUSD strategies, bridged over Wormhole.</p></li>
        </ol>
      </section>

      <footer className="footer">
        <div className="footer-top">
          <div>
            <p className="footer-lead">Deposit MUSD. Help hold it at $1.</p>
            <CtaLink href="/app" light>Launch app</CtaLink>
          </div>
          <nav aria-label="Footer">
            <a href="/app">App</a>
            {VAULT && <a href={`${EXPLORER}/address/${VAULT}`} target="_blank" rel="noreferrer">Vault contract</a>}
            {GITHUB && <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>}
            <a href="https://mezo.org" target="_blank" rel="noreferrer">Mezo</a>
          </nav>
        </div>
        <p className="footer-mark" aria-hidden="true">Tiller</p>
        <p className="disclaimer">
          Tiller Finance is hackathon software on Mezo testnet, built for the Mezo Buildathon. Contracts are unaudited. Testnet
          figures are not a promise of mainnet returns. MUSD and MEZO are Mezo's; Claude is Anthropic's.
        </p>
      </footer>
    </div>
  );
}
