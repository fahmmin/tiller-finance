import type { ReactNode } from "react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a className={`logo ${light ? "light" : ""}`} href="/" aria-label="Tiller Finance home">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="20" className="logo-disc" />
        {/* a tiller: the handle that steers a boat, drawn as a bar over a waterline */}
        <path d="M11 24.5h18" className="logo-line" />
        <path d="M20 11v13.5" className="logo-line" />
        <circle cx="20" cy="11" r="3.2" className="logo-knob" />
        <path d="M13 29c2.3 1.6 4.6 1.6 7 0s4.7-1.6 7 0" className="logo-wave" />
      </svg>
      <span>Tiller</span>
    </a>
  );
}

export function Tag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={`tag ${dark ? "dark" : ""}`}><i />{children}<i /></span>;
}

export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CtaLink({ href, children, ghost = false, light = false }: { href: string; children: ReactNode; ghost?: boolean; light?: boolean }) {
  const external = href.startsWith("http");
  return (
    <a className={`cta ${ghost ? "ghost" : ""} ${light ? "light" : ""}`} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <span>{children}</span>
      {!ghost && <b className="cta-dot"><Arrow /></b>}
    </a>
  );
}
