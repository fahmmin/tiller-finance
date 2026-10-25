import { useState } from "react";
import { EXPLORER, fmt } from "../chain";
import { ACTION_TEXT, type Decision } from "../live";
import { Card, ago, type PageProps } from "./parts";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "PEG_ARB", label: "Peg trades" },
  { key: "SP", label: "Stability Pool" },
  { key: "HARVEST", label: "Harvests" },
  { key: "NOTE", label: "Held off" },
];

const matches = (d: Decision, f: string) => f === "all" || d.action === f || (f === "SP" && d.action.startsWith("SP_"));

function amountText(d: Decision) {
  if (d.action === "PEG_ARB") return <span className="num pos">+{fmt(d.result, 3)} MUSD</span>;
  if (d.action === "HARVEST") return <span className="num">{fmt(d.amount, 6)} BTC → {fmt(d.result, 2)}</span>;
  if (d.action.startsWith("SP_")) return <span className="num">{fmt(d.amount, 2)} MUSD</span>;
  return <span className="muted">—</span>;
}

export function Activity({ live }: PageProps) {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string>();
  const rows = live.feed?.filter((d) => matches(d, filter));

  return (
    <Card title="Every decision, with its reason" action={
      <div className="chips" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
    }>
      <p className="muted small intro">A rule-based keeper proposes each move. Claude reviews it and can stop it. The reason below is written on Mezo with the transaction.</p>
      <div className="table activity">
        <div className="tr th"><span>Action</span><span>Amount</span><span>When</span><span /></div>
        {!rows ? [0, 1, 2].map((i) => <div className="tr" key={i}><span className="skel" /></div>)
          : rows.length === 0 ? <div className="tr"><span className="muted">Nothing here yet.</span></div>
          : rows.map((d) => {
            const id = d.tx + d.action;
            const isOpen = open === id;
            return (
              <div key={id} className={`tr-group ${isOpen ? "open" : ""}`}>
                <button className="tr" onClick={() => setOpen(isOpen ? undefined : id)} aria-expanded={isOpen}>
                  <span className="act"><i className={`dot-badge ${d.action}`} />{ACTION_TEXT[d.action] ?? d.action}{d.earlier && <em>earlier vault</em>}</span>
                  {amountText(d)}
                  <span className="muted" title={d.time ? new Date(d.time * 1000).toLocaleString() : ""}>{ago(d.time)}</span>
                  <span className="chev" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="tr-detail">
                    <span className="detail-label">Claude's reason</span>
                    <p>{d.why}</p>
                    <a href={`${EXPLORER}/tx/${d.tx}`} target="_blank" rel="noreferrer">Transaction {d.tx.slice(0, 10)}… · block {d.block.toLocaleString()}</a>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Card>
  );
}
