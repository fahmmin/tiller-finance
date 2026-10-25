import { useState } from "react";
import { Branches, Padlock, Relay, Vault } from "@lucasmarkes/hairline/react";
import { fmt } from "./chain";
import type { Vault as VaultState } from "./live";
import { CtaLink, MezoBadge, Tag, Term } from "./ui";

const REDEMPTION_FEE = 0.0075; // Mezo charges 0.75% to redeem MUSD for BTC
const SWAP_FEE = 0.003; // Mezo Pools basic pool fee

/* ---------- 1. MUSD in 30 seconds ---------- */

const MUSD_STEPS = [
  { icon: "₿", title: "Someone locks Bitcoin on Mezo", body: "A Bitcoin holder needs dollars but doesn't want to sell. They lock their BTC in Mezo as a deposit." },
  { icon: "$", title: "Mezo lends them MUSD", body: "Mezo creates MUSD for them: a digital dollar like USDT. Every MUSD is backed by at least $1.10 of locked Bitcoin." },
  { icon: "⇄", title: "1 MUSD can always become $1 of Bitcoin", body: "Anyone can hand 1 MUSD back to Mezo and get $1 of that Bitcoin (minus a 0.75% fee). That promise is what keeps MUSD near $1." },
];

export function MusdBasics() {
  return (
    <section className="basics" id="basics">
      <div className="section-head center">
        <Tag>New here? Start with this</Tag>
        <h2>MUSD in 30 seconds.</h2>
        <p>If you've used USDT, you already get most of it. Here's the one difference that makes Tiller possible.</p>
      </div>
      <ol className="basics-steps">
        {MUSD_STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="basics-icon" aria-hidden="true">{s.icon}</span>
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="compare" role="table" aria-label="USDT compared with MUSD">
        <div className="compare-row head" role="row">
          <span role="columnheader" />
          <span role="columnheader">USDT</span>
          <span role="columnheader" className="musd-col"><img src="/brand/musd.svg" alt="" /> MUSD on Mezo</span>
        </div>
        {[
          ["Who makes it", "Tether, a company", "Mezo's smart contracts, in the open"],
          ["What backs each $1", "Cash and bonds in banks you can't see", "At least $1.10 of Bitcoin you can check on chain"],
          ["Can you swap it for $1?", "Only large, verified accounts, through Tether", "Anyone, any amount, any time, through Mezo"],
          ["Where savings yield comes from", "Hidden: lent out by an exchange or company", "Visible: two jobs on chain, explained below"],
        ].map(([q, a, b]) => (
          <div className="compare-row" role="row" key={q}>
            <span role="rowheader">{q}</span>
            <span role="cell">{a}</span>
            <span role="cell" className="musd-col">{b}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 2. Where the yield comes from ---------- */

function pegTrade(price: number, amount: number) {
  // redeem at $1 minus the fee, then buy MUSD back at `price` minus the swap fee
  const out = (amount * (1 - REDEMPTION_FEE) / price) * (1 - SWAP_FEE);
  return { out, profit: out - amount };
}

export function YieldEngines() {
  const [price, setPrice] = useState(0.95);
  const amount = 1000;
  const { out, profit } = pegTrade(price, amount);
  const pays = profit > 0;
  const max = Math.max(amount, out);

  return (
    <section className="engines" id="yield">
      <div className="section-head center">
        <Tag>Where the yield comes from</Tag>
        <h2>Two jobs. No hidden lending.</h2>
        <p>
          Exchanges pay interest on USDT by lending it out somewhere you can't see. Tiller earns from two public jobs on Mezo
          that keep MUSD healthy. When neither job is needed, the vault waits and earns little. That's the honest trade-off.
        </p>
      </div>

      <article className="engine">
        <div className="engine-copy">
          <span className="engine-kicker red">Job 1</span>
          <h3>Buy dollars on sale.</h3>
          <p>
            Sometimes people sell MUSD for less than $1, say $0.95, because they want out fast. Tiller buys those discounted
            dollars by handing MUSD to Mezo's <Term tip="Mezo's promise: give it 1 MUSD, get $1 of Bitcoin back, minus a 0.75% fee.">redemption desk</Term>,
            then selling the Bitcoin back where MUSD is cheap. It ends with more MUSD than it started, and its buying pushes
            the price back toward $1.
          </p>
          <ol className="flow" aria-label="How a peg trade works">
            <li><b>1</b><span>Hand <strong>1,000 MUSD</strong> to Mezo</span></li>
            <li><b>2</b><span>Get <strong>$992.50 of Bitcoin</strong> back ($1 each, minus 0.75%)</span></li>
            <li><b>3</b><span>Sell that Bitcoin where MUSD costs <strong>${price.toFixed(3)}</strong></span></li>
            <li className="flow-end"><b>✓</b><span>Get back <strong>{pays ? out.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "less than you put in"} MUSD</strong></span></li>
          </ol>
        </div>

        <div className="engine-demo">
          <label className="slider">
            <span>Try it: what is MUSD selling for?</span>
            <strong>${price.toFixed(3)}</strong>
            <input type="range" min={0.9} max={1.02} step={0.005} value={price} onChange={(e) => setPrice(Number(e.target.value))}
              aria-valuetext={`$${price.toFixed(3)}`} />
            <span className="slider-scale" aria-hidden="true"><i>$0.90</i><i style={{ left: `${((1 - 0.9) / 0.12) * 100}%` }}>$1.00</i><i>$1.02</i></span>
          </label>
          <div className="trade-bars" role="img" aria-label={`Put in ${amount} MUSD, get back ${out.toFixed(2)} MUSD`}>
            <div className="tb-row">
              <span>You put in</span>
              <div className="tb-track"><i className="tb-in" style={{ width: `${(amount / max) * 100}%` }} /></div>
              <strong>1,000</strong>
            </div>
            <div className="tb-row">
              <span>You get back</span>
              <div className="tb-track"><i className={pays ? "tb-out" : "tb-out loss"} style={{ width: `${(out / max) * 100}%` }} /></div>
              <strong>{out.toLocaleString("en-US", { maximumFractionDigits: 1 })}</strong>
            </div>
          </div>
          <p className={`verdict ${pays ? "good" : ""}`}>
            {pays
              ? `+${profit.toFixed(2)} MUSD on 1,000 (${((profit / amount) * 100).toFixed(1)}%). The vault would make this trade.`
              : "No profit at this price, so the vault waits. The contract refuses any trade that would lose money."}
          </p>
          <p className="fine">Before price impact. Real trades are sized so the profit holds after the price moves.</p>
        </div>
      </article>

      <article className="engine reverse">
        <div className="engine-copy">
          <span className="engine-kicker green">Job 2</span>
          <h3>Be Mezo's safety fund.</h3>
          <p>
            Borrowers lock Bitcoin to borrow MUSD. If Bitcoin falls too far, a loan becomes unsafe and Mezo closes it. Mezo's{" "}
            <Term tip="A shared pool of MUSD that repays unsafe loans and receives their Bitcoin at a discount.">Stability Pool</Term>{" "}
            pays off the loan and receives the borrower's Bitcoin, worth more than the debt it covered. Tiller keeps most of its
            MUSD in that pool, then sells the Bitcoin back to MUSD.
          </p>
          <p className="muted small">Like an insurer that pays a claim and keeps a car worth more than the payout.</p>
        </div>
        <div className="engine-demo">
          <div className="sp-example" role="img" aria-label="The pool pays 1,000 MUSD and receives about 1,094.50 dollars of Bitcoin">
            <div className="sp-col">
              <div className="sp-bar paid" style={{ height: "68%" }}><span>1,000</span></div>
              <p>MUSD the pool pays to close a loan</p>
            </div>
            <div className="sp-arrow" aria-hidden="true">→</div>
            <div className="sp-col">
              <div className="sp-bar got" style={{ height: "74.4%" }}><span>~1,094</span></div>
              <p>Dollars of Bitcoin it receives</p>
            </div>
          </div>
          <p className="verdict good">About +9% on the MUSD used, when a loan is closed at Mezo's 110% line.</p>
          <p className="fine">Loans close at 110% of their debt; the person closing it keeps 0.5%. Gains only happen when loans are closed.</p>
        </div>
      </article>
    </section>
  );
}

/* ---------- 3. Follow $1,000 ---------- */

export function FollowThousand({ vault }: { vault?: VaultState }) {
  const total = vault && vault.total > 0n ? Number(vault.total) : 0;
  const idlePct = total ? (Number(vault!.idle) / total) * 100 : 20;
  const spPct = 100 - idlePct;
  const segs = [
    { key: "sp", label: "Stability Pool", pct: spPct, cls: "seg-sp", note: "Earning from loan closures. Capped at 80%." },
    { key: "idle", label: "Ready cash", pct: idlePct, cls: "seg-idle", note: "For instant withdrawals and peg trades. Never under 10%." },
  ];
  return (
    <section className="follow">
      <div className="follow-copy">
        <Tag>Follow your money</Tag>
        <h2>Where $1,000 sits right now.</h2>
        <p>
          This is the live split of the testnet vault, read from Mezo. Peg trades borrow from ready cash and return it, plus
          profit, in the same transaction, so they never leave money stranded.
        </p>
      </div>
      <div className="follow-chart">
        <div className="alloc" role="img" aria-label={segs.map((s) => `${s.label} ${s.pct.toFixed(0)}%`).join(", ")}>
          {segs.map((s) => (
            <div key={s.key} className={`alloc-seg ${s.cls}`} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.pct.toFixed(1)}%`}>
              <span>${Math.round(s.pct * 10)}</span>
            </div>
          ))}
        </div>
        <ul className="legend">
          {segs.map((s) => (
            <li key={s.key}>
              <i className={s.cls} />
              <div>
                <strong>{s.label} · {s.pct.toFixed(0)}%</strong>
                <span>{s.note}</span>
              </div>
            </li>
          ))}
          <li>
            <i className="seg-arb" />
            <div>
              <strong>Peg trades · when MUSD dips</strong>
              <span>Uses ready cash for one transaction, returns it with profit.</span>
            </div>
          </li>
        </ul>
        <p className="fine">{vault ? `Vault total: ${fmt(vault.total)} MUSD on Mezo testnet.` : "Loading the live vault…"}</p>
      </div>
    </section>
  );
}

/* ---------- 4. Moving figures for the four parts and the safety story ---------- */

export const PART_FIGURES = [Relay, Vault, Branches, Padlock];

export function SafetyFigures() {
  return (
    <div className="figures-row">
      <figure>
        <Padlock play intensity={0.6} label="A padlock opening as the pointer nears" className="hairline-fig" />
        <figcaption>Hard limits in the contract. Hover to test the lock.</figcaption>
      </figure>
      <figure>
        <Vault play intensity={0.6} label="A vault door whose dial turns with the pointer" className="hairline-fig" />
        <figcaption>Withdraw any time. Even a pause can't lock the door.</figcaption>
      </figure>
    </div>
  );
}

/* ---------- 5. Built on Mezo ---------- */

export function BuiltOnMezo() {
  const pieces = [
    { name: "MUSD", body: "The Bitcoin-backed dollar the vault holds." },
    { name: "Redemptions", body: "Mezo's $1-of-Bitcoin promise, used for peg trades." },
    { name: "Stability Pool", body: "Mezo's safety fund, where idle MUSD earns." },
    { name: "Mezo Pools", body: "Where the vault sells Bitcoin back for MUSD." },
    { name: "Price oracle", body: "Mezo's live BTC price, the floor for every sale." },
  ];
  return (
    <section className="mezo-block" id="mezo">
      <div className="mezo-top">
        <img className="mezo-mark" src="/brand/mezo-mark.svg" alt="" />
        <div>
          <MezoBadge dark />
          <h2>Mezo is the Bitcoin bank you don't have to trust.</h2>
          <p>
            Mezo lets people live off their Bitcoin without selling it: borrow MUSD against BTC, earn, and spend, with no bank
            in the middle. Built by Thesis, the team behind tBTC, Fold and Taho. Tiller is built on top of it and makes MUSD
            stronger.
          </p>
          <div className="mezo-ctas">
            <CtaLink href="https://mezo.org" light>Visit Mezo</CtaLink>
            <CtaLink href="https://testnet.mezo.org" ghost>Try the Mezo testnet</CtaLink>
          </div>
        </div>
      </div>
      <div className="mezo-stats">
        <div><strong>$64M</strong><span>Locked in Mezo Earn</span></div>
        <div><strong>$7.4M</strong><span>In Mezo Vaults (sMUSD)</span></div>
        <div><strong>5</strong><span>Mezo building blocks Tiller plugs into</span></div>
      </div>
      <ul className="mezo-pieces">
        {pieces.map((p) => (
          <li key={p.name}><img src="/brand/mezo-mark.svg" alt="" /><strong>{p.name}</strong><span>{p.body}</span></li>
        ))}
      </ul>
      <p className="fine light">Figures from DefiLlama, Oct 25, 2026. Tiller is an independent project built for the Mezo Buildathon; Mezo, MUSD and the Mezo logo belong to Mezo.</p>
    </section>
  );
}

/* ---------- 6. FAQ ---------- */

const FAQ = [
  ["Is this like USDT savings on an exchange?", "Same idea, different engine. You deposit digital dollars and they grow. But no company lends your money out: the yield comes from two public jobs on Mezo, and every move is on chain for anyone to check."],
  ["Why would Mezo give me $1 of Bitcoin for 1 MUSD?", "That's MUSD's core promise. Every MUSD is backed by locked Bitcoin, and Mezo lets anyone swap MUSD for that Bitcoin at $1 (minus 0.75%). When MUSD trades at $0.95, that promise is a discount waiting to be used."],
  ["When does the vault earn nothing?", "When MUSD sits at $1 and no loans are being closed. Then your MUSD waits in the safety fund and ready cash. Yield comes in bursts, when markets move."],
  ["What does Claude, the AI, actually do?", "A simple bot proposes each move. Claude checks the numbers and can say no, with a reason written on chain. It can't move money on its own, and if it's unreachable nothing moves."],
  ["Can I withdraw any time?", "Yes. At least 10% is always kept as ready cash, and the rest can be pulled from the Stability Pool. A pause stops trading, never withdrawals."],
  ["What can go wrong?", "This is unaudited hackathon code, running on Mezo testnet today. On a real network, risks include contract bugs, a sharp Bitcoin crash, and MUSD staying below $1 for a long time. Only deposit what you can afford to lose."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="faq" id="faq">
      <div className="section-head center">
        <Tag>Plain answers</Tag>
        <h2>Questions people ask first.</h2>
      </div>
      <ul>
        {FAQ.map(([q, a], i) => (
          <li key={q} className={open === i ? "open" : ""}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {q}
              <span aria-hidden="true">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <p>{a}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
