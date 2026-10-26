// Builds docs/tldraw/tiller-architecture.tldr for the demo video: open tldraw.com → menu → File → Open.
// Records are checked against tldraw's own schema (tlschema 5.5.2) before writing. Run: node build-board.mjs
import fs from "node:fs";
import { createBindingId, createShapeId, createTLSchema, toRichText } from "@tldraw/tlschema";
import { getIndexAbove } from "@tldraw/utils";

const schema = createTLSchema();
const PAGE = "page:page";
const shapes = [];
const bindings = [];

const base = (type, x, y, props) => ({
  id: createShapeId(), typeName: "shape", type, x, y, rotation: 0, index: "a1",
  parentId: PAGE, isLocked: false, opacity: 1, meta: {}, props,
});

/** A labelled box. color/fill follow the site: green Stability Pool, red peg trades, violet ready cash. */
function box(x, y, w, h, text, { color = "black", fill = "semi", geo = "rectangle", size = "m", dash = "draw" } = {}) {
  const s = base("geo", x, y, {
    geo, dash, url: "", w, h, growY: 0, scale: 1, flipX: false, flipY: false, labelColor: "black",
    color, fill, size, font: "draw", align: "middle", verticalAlign: "middle", richText: toRichText(text),
  });
  shapes.push(s);
  return s;
}

function text(x, y, value, { size = "m", color = "black", w = 600 } = {}) {
  shapes.push(base("text", x, y, { color, size, font: "draw", textAlign: "start", w, richText: toRichText(value), scale: 1, autoSize: false }));
}

const center = (s) => ({ x: s.x + s.props.w / 2, y: s.y + s.props.h / 2 });

/** An arrow bound to both boxes, so it follows them when moved on stage. */
function arrow(from, to, label = "", { color = "black", dash = "draw", bend = 0 } = {}) {
  const a = center(from), b = center(to);
  const s = base("arrow", a.x, a.y, {
    kind: "arc", labelColor: "black", color, fill: "none", dash, size: "m", arrowheadStart: "none", arrowheadEnd: "arrow",
    font: "draw", start: { x: 0, y: 0 }, end: { x: b.x - a.x, y: b.y - a.y }, bend, richText: toRichText(label),
    labelPosition: 0.5, scale: 1, elbowMidPoint: 0.5,
  });
  shapes.push(s);
  for (const [terminal, target] of [["start", from], ["end", to]]) {
    bindings.push({
      id: createBindingId(), typeName: "binding", type: "arrow", fromId: s.id, toId: target.id, meta: {},
      props: { terminal, normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: "none" },
    });
  }
}

// ---------- 1. how the money earns ----------
text(0, -170, "Tiller Finance: MUSD savings that defend MUSD's $1 peg", { size: "xl", w: 1500 });
text(0, -100, "Built on Mezo · MUSD is Mezo's Bitcoin-backed dollar (1 MUSD always redeems for $1 of BTC, minus 0.75%)", { size: "s", color: "grey", w: 1500 });

const user = box(0, 40, 260, 130, "Depositor\nputs in MUSD,\ngets tMUSD shares", { geo: "ellipse", color: "black", fill: "none" });
const vault = box(470, 20, 420, 170, "TillerVault (ERC-4626)\nholds everyone's MUSD\nwithdraw any time", { color: "black", fill: "solid", size: "l" });
arrow(user, vault, "deposit MUSD");

const idle = box(0, 330, 340, 170, "Ready cash  ≥ 10%\ninstant withdrawals\n+ fuel for peg trades", { color: "violet" });
const sp = box(470, 330, 420, 170, "Mezo Stability Pool  ≤ 80%\npays off risky loans,\ngets their BTC ~10% cheaper", { color: "green" });
const peg = box(1020, 330, 440, 170, "Peg trade (only when MUSD < $1)\nmust end with MORE MUSD\nor the contract reverts", { color: "red" });
arrow(vault, idle, "", { color: "violet" });
arrow(vault, sp, "", { color: "green" });
arrow(vault, peg, "", { color: "red" });

const harvest = box(470, 600, 420, 130, "Harvest\nsell liquidation BTC → MUSD\n(never below oracle − 1.5%)", { color: "green", fill: "none" });
arrow(sp, harvest, "liquidation BTC", { color: "green" });
arrow(harvest, vault, "MUSD back", { color: "green", dash: "dashed", bend: -300 }); // arcs through the gap left of the pool

const redeem = box(1020, 600, 440, 130, "1. Mezo redemption desk\nhand in MUSD → get $1 of BTC each", { color: "red", fill: "none" });
const sell = box(1020, 800, 440, 130, "2. Mezo Pools\nsell that BTC where MUSD is cheap\n→ more MUSD than before", { color: "red", fill: "none" });
arrow(peg, redeem, "", { color: "red" });
arrow(redeem, sell, "BTC", { color: "red" });
arrow(sell, vault, "+ profit", { color: "red", dash: "dashed", bend: 520 }); // arcs outside, right of the peg column
text(1540, 620, "Buying cheap MUSD\npushes its price\nback toward $1", { size: "s", color: "red", w: 240 });

// ---------- 2. who decides ----------
const y2 = 1080;
text(0, y2, "Every move: proposed by a bot, checked by Claude, enforced by the contract", { size: "l", w: 1500 });
const keeper = box(0, y2 + 90, 300, 150, "Keeper bot\nreads Mezo,\nplans with fixed rules", { color: "black", fill: "none" });
const claude = box(420, y2 + 90, 300, 150, "Claude (AI)\napprove or VETO\nonly power: say no", { color: "orange" });
const guard = box(840, y2 + 90, 320, 150, "Contract guardrails\ncaps · whitelist · oracle floor\npeg trade must profit", { color: "black", fill: "solid" });
const chain = box(1280, y2 + 90, 280, 150, "Mezo transaction\n+ reason written\non-chain", { color: "blue" });
arrow(keeper, claude, "plan");
arrow(claude, guard, "ok");
arrow(guard, chain, "pass");
text(420, y2 + 270, "AI down or unsure? → nothing moves (fails closed)\nPause stops trading, never withdrawals", { size: "s", color: "grey", w: 700 });

// ---------- 3. proof ----------
const y3 = y2 + 400;
text(0, y3, "Proved on Mezo testnet (Oct 25, 2026)", { size: "l", w: 1500 });
box(0, y3 + 80, 440, 150, "+0.118 MUSD\nfirst live peg trade (+3.7%)\nClaude approved", { color: "yellow", fill: "solid" });
box(500, y3 + 80, 440, 150, "240 MUSD\ninto Mezo's Stability Pool\n(exactly the 80% cap)", { color: "light-green", fill: "solid" });
box(1000, y3 + 80, 460, 150, "15 tests + real MetaMask\nend-to-end: connect, approve,\ndeposit, withdraw", { color: "light-blue", fill: "solid" });

// ---------- assemble ----------
let index = getIndexAbove(); // paint order follows creation order
for (const s of shapes) { s.index = index; index = getIndexAbove(index); }
const document = { id: "document:document", typeName: "document", gridSize: 10, name: "Tiller Finance architecture", meta: {} };
const page = { id: PAGE, typeName: "page", name: "Architecture", index: "a1", meta: {} };
const records = [document, page, ...shapes, ...bindings];
for (const r of records) schema.types[r.typeName].validate(r); // throws on any field tldraw wouldn't accept

const file = { tldrawFileFormatVersion: 1, schema: schema.serialize(), records };
fs.writeFileSync(new URL("./tiller-architecture.tldr", import.meta.url), JSON.stringify(file, null, 2));
console.log(`wrote tiller-architecture.tldr: ${shapes.length} shapes, ${bindings.length} bindings, all valid`);
