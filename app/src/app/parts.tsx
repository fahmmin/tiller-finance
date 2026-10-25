import { useState, type ReactNode } from "react";
import { EXPLORER } from "../chain";
import { icons } from "./icons";

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** In-app link that changes the page without reloading. */
export function Go({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={to} className={className} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      history.pushState(null, "", to);
      dispatchEvent(new PopStateEvent("popstate"));
      scrollTo(0, 0);
    }}>{children}</a>
  );
}

export function Stat({ label, value, unit, sub, loading }: { label: string; value?: ReactNode; unit?: string; sub?: ReactNode; loading?: boolean }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      {loading || value === undefined ? <span className="skel" style={{ width: "60%", height: 30 }} /> : (
        <strong className="stat-value">{value}{unit && <small>{unit}</small>}</strong>
      )}
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Address({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="addr">
      {label && <span className="addr-label">{label}</span>}
      <code>{short(value)}</code>
      <button aria-label={`Copy ${label ?? "address"}`} onClick={() => {
        navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
      }}>{copied ? "✓" : icons.copy}</button>
      <a aria-label={`Open ${label ?? "address"} on the explorer`} href={`${EXPLORER}/address/${value}`} target="_blank" rel="noreferrer">{icons.external}</a>
    </span>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "plain"; children: ReactNode }) {
  return <span className={`pill ${tone}`}><i />{children}</span>;
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`acard ${className}`}>
      {(title || action) && <header className="acard-head">{title && <h2>{title}</h2>}{action}</header>}
      {children}
    </section>
  );
}

export const ago = (t?: number) => {
  if (!t) return "";
  const s = Math.max(1, Math.round(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** The peg status for one pool price, in words a depositor understands. */
export function pegStatus(price?: number): { tone: "good" | "warn" | "bad" | "info"; text: string } {
  if (price === undefined) return { tone: "info", text: "Loading" };
  if (price < 0.9895) return { tone: "bad", text: "Below peg: buybacks pay" };
  if (price < 0.998) return { tone: "warn", text: "Slightly below $1" };
  if (price <= 1.002) return { tone: "good", text: "On peg" };
  return { tone: "info", text: "Above $1: vault waits" };
}

export type PageProps = { live: ReturnType<typeof import("../live").useLive>; wallet: import("./wallet").Wallet };
