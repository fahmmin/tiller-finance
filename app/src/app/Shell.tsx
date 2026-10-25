import { useEffect, useRef, useState } from "react";
import { EXPLORER, fmt, mezoTestnet } from "../chain";
import { useLive } from "../live";
import { GITHUB } from "../proof";
import { Logo } from "../ui";
import { Activity } from "./Activity";
import { Earn } from "./Earn";
import { icons } from "./icons";
import { Overview } from "./Overview";
import { Peg } from "./Peg";
import { Go, Pill, short } from "./parts";
import { Risk } from "./Risk";
import { ToastProvider, useToast } from "./toast";
import { useWallet } from "./wallet";

const ROUTES = [
  { path: "/app", name: "Overview", icon: icons.overview, Page: Overview },
  { path: "/app/earn", name: "Earn", icon: icons.earn, Page: Earn },
  { path: "/app/peg", name: "Peg monitor", icon: icons.peg, Page: Peg },
  { path: "/app/activity", name: "Activity", icon: icons.activity, Page: Activity },
  { path: "/app/risk", name: "Risk & contracts", icon: icons.risk, Page: Risk },
];

function usePath() {
  const [path, setPath] = useState(location.pathname.replace(/\/$/, "") || "/app");
  useEffect(() => {
    const on = () => setPath(location.pathname.replace(/\/$/, "") || "/app");
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);
  return path;
}

export default function AppShell() {
  return <ToastProvider><Shell /></ToastProvider>;
}

function Shell() {
  const path = usePath();
  const live = useLive();
  const wallet = useWallet();
  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0];
  const Page = route.Page;

  useEffect(() => { document.title = `${route.name} · Tiller Finance`; }, [route.name]);

  return (
    <div className="shell">
      <aside className="side">
        <Logo />
        <span className="side-tag">MUSD peg vault</span>
        <nav aria-label="App">
          {ROUTES.map((r) => (
            <Go key={r.path} to={r.path} className={r.path === route.path ? "active" : ""}>{r.icon}<span>{r.name}</span></Go>
          ))}
        </nav>
        <div className="side-foot">
          <div className="net-card">
            <div className="net-row"><img src="/brand/mezo-mark.svg" alt="" /><strong>Mezo Testnet</strong><i className={live.block ? "dot ok" : "dot"} /></div>
            <span>Block {live.block ? live.block.toLocaleString() : "…"}</span>
            <span>BTC ${live.btcUsd ? live.btcUsd.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "…"}</span>
          </div>
          <a href="/" className="side-link">About Tiller</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="side-link">GitHub</a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="crumb">Tiller</span>
            <h1>{route.name}</h1>
          </div>
          <div className="topbar-right">
            <span className="net-pill"><img src="/brand/mezo-mark.svg" alt="" />Mezo Testnet</span>
            <WalletButton wallet={wallet} />
          </div>
        </header>

        {wallet.wrongNetwork && (
          <div className="banner warn" role="alert">
            Your wallet is on another network. Tiller runs on Mezo Testnet (chain {mezoTestnet.id}).
            <button className="abtn small" onClick={() => wallet.switchNetwork()}>Switch network</button>
          </div>
        )}
        {live.vault?.paused && <div className="banner info">Trading is paused by the guardian. Withdrawals still work.</div>}
        {live.error && <div className="banner warn">{live.error}</div>}

        <main className="page" key={route.path}>
          <Page live={live} wallet={wallet} />
        </main>
      </div>

      <nav className="tabbar" aria-label="App">
        {ROUTES.map((r) => (
          <Go key={r.path} to={r.path} className={r.path === route.path ? "active" : ""}>{r.icon}<span>{r.name.split(" ")[0]}</span></Go>
        ))}
      </nav>
    </div>
  );
}

function WalletButton({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, []);

  if (!wallet.address) {
    return (
      <button className="abtn" onClick={() => wallet.connect().catch((e) => toast({ kind: "error", title: "Couldn't connect", body: e.shortMessage ?? e.message }))}>
        Connect wallet
      </button>
    );
  }
  return (
    <div className="acct" ref={box}>
      <button className="acct-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <i className="avatar" style={{ background: `conic-gradient(from ${parseInt(wallet.address.slice(2, 6), 16) % 360}deg, #9efc65, #1f8a70, #6b5bd6, #ff004d, #9efc65)` }} />
        <span>{short(wallet.address)}</span>
        {wallet.account && <small>{fmt(wallet.account.musd, 2)} MUSD</small>}
      </button>
      {open && (
        <div className="acct-menu">
          <div className="acct-bal">
            <span>Wallet</span>
            <strong>{fmt(wallet.account?.musd)} MUSD</strong>
            <small>{fmt(wallet.account?.btc, 5)} BTC for gas</small>
          </div>
          <button onClick={() => navigator.clipboard?.writeText(wallet.address!)}>{icons.copy}Copy address</button>
          <a href={`${EXPLORER}/address/${wallet.address}`} target="_blank" rel="noreferrer">{icons.external}View on explorer</a>
          <a href="https://testnet.mezo.org" target="_blank" rel="noreferrer">{icons.earn}Get test MUSD on Mezo</a>
          <button onClick={() => { wallet.disconnect(); setOpen(false); }}>{icons.logout}Disconnect</button>
          {wallet.wrongNetwork && <Pill tone="warn">Wrong network</Pill>}
        </div>
      )}
    </div>
  );
}
