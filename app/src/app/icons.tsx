// 20px stroke icons for the app navigation.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const icons = {
  overview: <svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.5" {...P} /><rect x="11" y="3" width="6" height="6" rx="1.5" {...P} /><rect x="3" y="11" width="6" height="6" rx="1.5" {...P} /><rect x="11" y="11" width="6" height="6" rx="1.5" {...P} /></svg>,
  earn: <svg viewBox="0 0 20 20"><path d="M3 15l4.5-4.5 3 3L17 7" {...P} /><path d="M12.5 7H17v4.5" {...P} /></svg>,
  peg: <svg viewBox="0 0 20 20"><path d="M2 10h16" {...P} /><circle cx="10" cy="10" r="3" {...P} /><path d="M10 3v2M10 15v2" {...P} /></svg>,
  activity: <svg viewBox="0 0 20 20"><path d="M2.5 10h3l2-5 4 10 2-5h4" {...P} /></svg>,
  risk: <svg viewBox="0 0 20 20"><path d="M10 2.5l6 2.5v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V5l6-2.5z" {...P} /><path d="M7.5 10l1.8 1.8L12.8 8" {...P} /></svg>,
  copy: <svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="2" {...P} /><path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" {...P} /></svg>,
  external: <svg viewBox="0 0 20 20"><path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3M11 4h5v5M16 4l-7 7" {...P} /></svg>,
  logout: <svg viewBox="0 0 20 20"><path d="M8 4H5a1 1 0 00-1 1v10a1 1 0 001 1h3M12 6l4 4-4 4M16 10H8" {...P} /></svg>,
};
