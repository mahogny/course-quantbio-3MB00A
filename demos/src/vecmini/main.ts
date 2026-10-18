// Minimal 2-D vector demos for the slides: a clean grid, a few arrows, big labels,
// draggable tips, a tiny readout. One demo, four modes (data-mode):
//
//   add     a, b and a + b; b also drawn dashed from the tip of a (tip to tail).
//           data-a="3 1" data-b="1 2"
//   scale   a and k·a, one slider for k in [−2, 3].   data-a="2 1" data-k="2"
//   dot     u and v, the angle arc; readout u·v and θ.  data-u="3 2" data-v="1 4"
//   rotate  R(θ)e₁ and R(θ)e₂ (the columns of R(θ)), the matrix live; one slider for θ,
//           or drag either tip around the unit circle.  data-theta="30"
//
// Dragged tips snap to integers (add, scale, dot) or to whole degrees (rotate).
// Layout: default = plot (500 px) with the readout to its right, ~880×500 px;
// data-layout="stack" = plot 440 px with a compact readout under it, ≤ 440×540 px (for a
// slide column); the reset is then a small ↺ in the plot's top-right corner.
// Auto-mounts on <div data-demo="vecmini" data-mode="...">.
import { svgEl, htmlEl, slider, button, draggable, svgPoint, numList, autoMount, setAttrs } from "../lib/ui";
import { V2, add, mul, dot, angleDeg, rotCols, fmt, fmtFixed, vec } from "./math";

const NAME = "vecmini";
type Mode = "add" | "scale" | "dot" | "rotate";

// Colours as in dotproduct (u/a blue, v/b orange) and matrix2x2 (column 1 red, column 2 blue).
const COL = { a: "#1f77b4", b: "#ff7f0e", res: "#d62728", c1: "#d62728", c2: "#1f77b4", faint: "#9a9a9a" };

const SIZE = 500;   // the plot is SIZE×SIZE px; the whole demo is SIZE px tall on a slide
const STACK = 440;  // data-layout="stack": plot STACK×STACK px with the panel under it

const STYLE = `
.qb-demo[data-demo="${NAME}"] { align-items: center; gap: 1.6em; }
.qb-demo[data-demo="${NAME}"] .vm-plot { flex: 0 1 ${SIZE}px; width: 100%; max-width: ${SIZE}px; height: auto; }
.qb-demo[data-demo="${NAME}"] .qb-panel { flex: 0 1 380px; gap: .7em; }
.qb-demo[data-demo="${NAME}"] .vm-ro { font-size: 1.25em; line-height: 1.5; font-variant-numeric: tabular-nums; }
.qb-demo[data-demo="${NAME}"] .vm-ro b { font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .vm-big { font-size: 1.35em; font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .qb-slider { font-size: 1.1em; }
.qb-demo[data-demo="${NAME}"] .qb-slider { grid-template-columns: auto minmax(8em, 14em) auto; }
.qb-demo[data-demo="${NAME}"] .qb-slider output { font-family: inherit; min-width: 3.2em; text-align: left; }
.qb-demo[data-demo="${NAME}"] .vm-nout output { display: none; }
.qb-demo[data-demo="${NAME}"] .vm-reset { align-self: flex-start; color: var(--qb-muted); border-color: #ddd; }
.qb-demo[data-demo="${NAME}"] .vm-mat { display: flex; align-items: center; gap: .4em; font-size: 1.2em; }
.qb-demo[data-demo="${NAME}"] .vm-br { display: inline-grid; grid-template-columns: auto auto; column-gap: 1em;
  padding: .1em .45em; border-left: 2px solid #222; border-right: 2px solid #222; border-radius: 8px;
  text-align: right; line-height: 1.3; font-variant-numeric: tabular-nums; font-weight: 600; }
.qb-demo[data-demo="${NAME}"] .vm-sym { color: var(--qb-muted); font-size: .8em; }
.qb-demo[data-demo="${NAME}"] .vm-sym .vm-br { font-weight: 400; border-color: #aaa; }
.qb-demo[data-demo="${NAME}"] svg text.vm-t { font-weight: 700; paint-order: stroke; stroke: #fff;
  stroke-width: 6px; stroke-linejoin: round; }
.reveal .qb-demo[data-demo="${NAME}"] { flex-wrap: nowrap; font-size: 22px; margin: .1em 0; }
.reveal .qb-demo[data-demo="${NAME}"] .vm-plot { flex: 0 0 ${SIZE}px; width: ${SIZE}px; height: ${SIZE}px; max-width: none; }
.qb-demo[data-demo="${NAME}"] .vm-i { display: block; }
/* stack layout: plot on top, a compact panel of one or two lines under it */
.qb-demo[data-demo="${NAME}"].vm-stack { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; gap: .25em;
  max-width: ${STACK}px; font-size: 20px; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-plot { flex: 0 0 auto; max-width: ${STACK}px; }
.reveal .qb-demo[data-demo="${NAME}"].vm-stack { font-size: 20px; margin: 0; }
.reveal .qb-demo[data-demo="${NAME}"].vm-stack .vm-plot { flex: 0 0 ${STACK}px; width: ${STACK}px; height: ${STACK}px; }
.qb-demo[data-demo="${NAME}"].vm-stack .qb-panel { flex: 0 0 auto; width: 100%; gap: .2em; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-ro { display: flex; flex-wrap: wrap; gap: 0 1.1em; font-size: 1.05em; line-height: 1.35; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-big { font-size: 1.15em; }
.qb-demo[data-demo="${NAME}"].vm-stack .qb-slider { font-size: 1em; grid-template-columns: auto minmax(6em, 1fr) auto; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-row { display: flex; align-items: center; gap: 1em; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-row .qb-slider { flex: 1 1 auto; }
.qb-demo[data-demo="${NAME}"].vm-stack .vm-mat { font-size: 1em; flex: 0 0 auto; }
.qb-demo[data-demo="${NAME}"] svg .vm-glyph { font-size: 30px; fill: #aaa; cursor: pointer; }
.qb-demo[data-demo="${NAME}"] svg .vm-glyph:hover { fill: #555; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------------------------
// A square plot: world [lo, hi]² (plus half a unit of margin), y up.
interface Plot {
  svg: SVGSVGElement; k: number;
  X(x: number): number; Y(y: number): number;
  world(ev: PointerEvent): V2;
  layer(): SVGGElement;
}

function makePlot(host: HTMLElement, lo: number, hi: number, label: string, ticks: boolean): Plot {
  const svg = svgEl("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "vm-plot", role: "img", "aria-label": label }, host);
  const m = ticks ? 0.5 : 0.08, k = SIZE / (hi - lo + 2 * m);
  const X = (x: number) => (x - lo + m) * k, Y = (y: number) => SIZE - (y - lo + m) * k;
  const p: Plot = {
    svg, k, X, Y,
    world: ev => { const [px, py] = svgPoint(svg, ev); return [px / k + lo - m, (SIZE - py) / k + lo - m]; },
    layer: () => svgEl("g", {}, svg),
  };
  const g = p.layer();
  if (ticks) {
    for (let i = Math.ceil(lo); i <= hi; i++) {
      if (i === 0) continue;
      svgEl("line", { x1: X(i), y1: 0, x2: X(i), y2: SIZE, class: "grid" }, g);
      svgEl("line", { x1: 0, y1: Y(i), x2: SIZE, y2: Y(i), class: "grid" }, g);
    }
    for (let i = Math.ceil(lo); i <= hi; i++) {
      if (i === 0 || i % 2 !== 0) continue;
      svgEl("text", { x: X(i), y: Y(0) + 21, "text-anchor": "middle", "font-size": 17, fill: "#888" }, g).textContent = fmt(i);
      svgEl("text", { x: X(0) - 8, y: Y(i) + 6, "text-anchor": "end", "font-size": 17, fill: "#888" }, g).textContent = fmt(i);
    }
  }
  svgEl("line", { x1: 0, y1: Y(0), x2: SIZE, y2: Y(0), class: "axis", "stroke-width": 1.5, opacity: ticks ? 1 : 0.35 }, g);
  svgEl("line", { x1: X(0), y1: 0, x2: X(0), y2: SIZE, class: "axis", "stroke-width": 1.5, opacity: ticks ? 1 : 0.35 }, g);
  return p;
}

interface Arrow { g: SVGGElement; set(from: V2, to: V2): void }

/** Arrow with a polygon head (no markers, so it scales cleanly inside reveal). */
function arrow(p: Plot, parent: Element, col: string, w: number, dash = "", op = 1): Arrow {
  const g = svgEl("g", { opacity: op }, parent);
  const line = svgEl("line", { stroke: col, "stroke-width": w, "stroke-linecap": dash ? "butt" : "round" }, g);
  if (dash) line.setAttribute("stroke-dasharray", dash);
  const head = svgEl("polygon", { fill: col }, g);
  return {
    g,
    set(from, to) {
      const x0 = p.X(from[0]), y0 = p.Y(from[1]), x1 = p.X(to[0]), y1 = p.Y(to[1]);
      const len = Math.hypot(x1 - x0, y1 - y0);
      g.style.display = len < 3 ? "none" : "";
      if (len < 3) return;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      const hl = Math.min(16 + 1.6 * w, len * 0.6), hw = 6 + 1.1 * w;
      const bx = x1 - ux * hl, by = y1 - uy * hl;
      setAttrs(line, { x1: x0, y1: y0, x2: bx + ux * 2, y2: by + uy * 2 });
      head.setAttribute("points", `${x1},${y1} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`);
    },
  };
}

/** A bold label near a point, offset by (dx, dy) screen px, kept inside the plot. */
function label(parent: Element, text: string, col: string, size = 26) {
  const t = svgEl("text", { class: "vm-t", fill: col, "font-size": size, "text-anchor": "middle", "dominant-baseline": "central" }, parent);
  t.textContent = text;
  t.style.fill = col;
  return (px: number, py: number, txt?: string) => {
    if (txt !== undefined) t.textContent = txt;
    const w = (t.getComputedTextLength && t.getComputedTextLength()) || size * t.textContent!.length * 0.55;
    const x = Math.min(Math.max(px, w / 2 + 4), SIZE - w / 2 - 4);
    const y = Math.min(Math.max(py, size * 0.6), SIZE - size * 0.6);
    setAttrs(t, { x, y });
    t.style.display = "";
  };
}

/** Screen point just beyond the tip of `to` (seen from `from`), `d` px further along. */
function beyond(p: Plot, from: V2, to: V2, d = 30): [number, number] {
  const x0 = p.X(from[0]), y0 = p.Y(from[1]), x1 = p.X(to[0]), y1 = p.Y(to[1]);
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-9) return [x1 + d * 0.7, y1 - d * 0.7];
  return [x1 + d * (x1 - x0) / len, y1 + d * (y1 - y0) / len];
}

function handle(parent: Element, col: string, r = 16): SVGCircleElement {
  const c = svgEl("circle", { r, class: "handle", stroke: col }, parent);
  c.style.fill = col;
  c.style.fillOpacity = "0.18";
  return c;
}
const place = (p: Plot, h: SVGCircleElement, a: V2) => setAttrs(h, { cx: p.X(a[0]), cy: p.Y(a[1]) });

/** Integer tip from a pointer position, clamped to the grid. */
const snapInt = (q: V2, lo: number, hi: number): V2 =>
  q.map(t => Math.max(lo, Math.min(hi, Math.round(t)))) as V2;

const span = (col: string, txt: string) => `<b style="color:${col}">${txt}</b>`;

function v2(s: string | undefined, fb: V2): V2 { return numList(s, fb).slice(0, 2) as V2; }

// ---------------------------------------------------------------------------------------
function mount(host: HTMLElement): void {
  injectStyle();
  const mode = (host.dataset.mode || "add") as Mode;
  if (host.dataset.layout === "stack") host.classList.add("vm-stack");
  if (mode === "scale") buildScale(host);
  else if (mode === "dot") buildDot(host);
  else if (mode === "rotate") buildRotate(host);
  else buildAdd(host);
}

const isStack = (host: HTMLElement) => host.classList.contains("vm-stack");

/** Reset: a small button under the readout, or (stack layout) a ↺ glyph in the plot's top-right corner. */
function addReset(host: HTMLElement, p: Plot, panel: HTMLElement, reset: () => void): void {
  if (!isStack(host)) { button(panel, "reset", reset, "vm-reset"); return; }
  const t = svgEl("text", { x: SIZE - 8, y: 30, "text-anchor": "end", class: "vm-glyph" });
  p.svg.insertBefore(t, p.svg.firstChild!.nextSibling);   // under the arrows and handles
  t.textContent = "↺";
  svgEl("title", {}, t).textContent = "reset";
  t.addEventListener("click", reset);
}

function panelWithReset(host: HTMLElement, p: Plot, reset: () => void) {
  const panel = htmlEl("div", "qb-panel", "", host);
  const ro = htmlEl("div", "vm-ro", "", panel);
  return { panel, ro, addReset: () => addReset(host, p, panel, reset) };
}

/** Readout items: one per line, or side by side in the stack layout. */
const items = (xs: string[]) => xs.map(x => `<span class="vm-i">${x}</span>`).join("");

// ---- add ------------------------------------------------------------------------------
function buildAdd(host: HTMLElement): void {
  const a0 = v2(host.dataset.a, [3, 1]), b0 = v2(host.dataset.b, [1, 2]);
  let a: V2 = [...a0], b: V2 = [...b0];
  const LO = -4, HI = 7;
  const p = makePlot(host, LO, HI, "Vectors a and b and their sum a + b", true);
  const gV = p.layer();
  const bCopy = arrow(p, gV, COL.b, 3.5, "9 7", 0.8);
  const sA = arrow(p, gV, COL.res, 5);
  const aA = arrow(p, gV, COL.a, 5), bA = arrow(p, gV, COL.b, 5);
  const gL = p.layer();
  const la = label(gL, "a", COL.a), lb = label(gL, "b", COL.b), ls = label(gL, "a + b", COL.res);
  const gH = p.layer();
  const ha = handle(gH, COL.a), hb = handle(gH, COL.b);
  draggable(ha, p.world, (x, y) => { a = snapInt([x, y], LO, HI); draw(); });
  draggable(hb, p.world, (x, y) => { b = snapInt([x, y], LO, HI); draw(); });
  const { ro, addReset } = panelWithReset(host, p, () => { a = [...a0]; b = [...b0]; draw(); });
  addReset();

  function draw(): void {
    const s = add(a, b);
    aA.set([0, 0], a); bA.set([0, 0], b); sA.set([0, 0], s); bCopy.set(a, s);
    place(p, ha, a); place(p, hb, b);
    la(...beyond(p, [0, 0], a)); lb(...beyond(p, [0, 0], b));
    ls(...beyond(p, [0, 0], s, 40));
    ro.innerHTML = items([`${span(COL.a, "a")} = ${vec(a)}`, `${span(COL.b, "b")} = ${vec(b)}`,
      `${span(COL.res, "a + b")} = ${vec(s)}`]);
  }
  draw();
}

// ---- scale ----------------------------------------------------------------------------
function buildScale(host: HTMLElement): void {
  const a0 = v2(host.dataset.a, [2, 1]);
  const kd = Number(host.dataset.k), k0 = Number.isFinite(kd) ? kd : 2;
  let a: V2 = [...a0], k = k0;
  const LO = -5, HI = 7;
  const p = makePlot(host, LO, HI, "A vector a and its multiple k·a", true);
  const gV = p.layer();
  const kA = arrow(p, gV, COL.res, 9, "", 0.55);
  const aA = arrow(p, gV, COL.a, 4.5);
  const gL = p.layer();
  const la = label(gL, "a", COL.a), lk = label(gL, "k·a", COL.res);
  const ha = handle(p.layer(), COL.a);
  draggable(ha, p.world, (x, y) => { a = snapInt([x, y], -4, 4); draw(); });
  const { panel, ro, addReset } = panelWithReset(host, p, () => { a = [...a0]; k = k0; ks.set(k0); draw(); });
  const ks = slider(panel, "k", -2, 3, 0.1, k0, v => { k = v; draw(); }, v => fmt(v, 1));
  ks.input.style.accentColor = COL.res;
  const stack = isStack(host);
  if (!stack) ks.input.parentElement!.classList.add("vm-nout");   // k is in the readout below
  panel.insertBefore(ks.input.parentElement!, ro);
  addReset();

  function draw(): void {
    const ka = mul(k, a);
    kA.set([0, 0], ka); aA.set([0, 0], a);
    place(p, ha, a);
    // "a" beside its tip (to the left of the arrow), "k·a" beyond the tip of k·a
    const L = Math.hypot(a[0], a[1]) || 1, nx = -a[1] / L, ny = a[0] / L;
    la(p.X(a[0]) + 30 * nx, p.Y(a[1]) - 30 * ny);
    lk(...beyond(p, [0, 0], ka, 34));
    ro.innerHTML = items([...(stack ? [] : [`k = ${fmt(k, 1)}`]), `${span(COL.a, "a")} = ${vec(a)}`,
      `${span(COL.res, "k·a")} = ${vec(ka)}`]);
  }
  draw();
}

// ---- dot ------------------------------------------------------------------------------
function buildDot(host: HTMLElement): void {
  const u0 = v2(host.dataset.u, [3, 2]), w0 = v2(host.dataset.v, [1, 4]);
  let u: V2 = [...u0], v: V2 = [...w0];
  const LO = -5, HI = 6;
  const p = makePlot(host, LO, HI, "Two vectors u and v and the angle between them", true);
  const gV = p.layer();
  const arc = svgEl("path", { fill: "none", stroke: "#444", "stroke-width": 2.5 }, gV);
  const vA = arrow(p, gV, COL.b, 5), uA = arrow(p, gV, COL.a, 5);
  const gL = p.layer();
  const lu = label(gL, "u", COL.a), lv = label(gL, "v", COL.b), lt = label(gL, "θ", "#333", 24);
  const gH = p.layer();
  const hv = handle(gH, COL.b), hu = handle(gH, COL.a);
  const drag = (set: (q: V2) => void) => (x: number, y: number) => {
    const q = snapInt([x, y], LO, HI);
    if (q[0] === 0 && q[1] === 0) return;   // keep the angle defined
    set(q); draw();
  };
  draggable(hu, p.world, drag(q => (u = q)));
  draggable(hv, p.world, drag(q => (v = q)));
  const { ro, addReset } = panelWithReset(host, p, () => { u = [...u0]; v = [...w0]; draw(); });
  addReset();

  function draw(): void {
    uA.set([0, 0], u); vA.set([0, 0], v);
    place(p, hu, u); place(p, hv, v);
    lu(...beyond(p, [0, 0], u)); lv(...beyond(p, [0, 0], v));
    const a1 = Math.atan2(u[1], u[0]), a2 = Math.atan2(v[1], v[0]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
    const R = 1.1, n = 32, pts: string[] = [];
    for (let i = 0; i <= n; i++) { const t = a1 + d * i / n; pts.push(`${p.X(R * Math.cos(t)).toFixed(1)},${p.Y(R * Math.sin(t)).toFixed(1)}`); }
    arc.setAttribute("d", "M" + pts.join(" L"));
    const am = a1 + d / 2;
    lt(p.X(1.85 * Math.cos(am)), p.Y(1.85 * Math.sin(am)));
    const th = angleDeg(u, v);
    ro.innerHTML = items([`<span class="vm-big">${span(COL.a, "u")}·${span(COL.b, "v")} = ${fmt(dot(u, v))}</span>`,
      `<span class="vm-big">θ = ${th === null ? "–" : Math.round(th) + "°"}</span>`]);
  }
  draw();
}

// ---- rotate ---------------------------------------------------------------------------
function buildRotate(host: HTMLElement): void {
  const td = Number(host.dataset.theta), t0 = Number.isFinite(td) ? td : 30;
  let th = t0;
  const p = makePlot(host, -1.45, 1.45, "Rotation R(θ): where the basis vectors e₁ and e₂ land", false);
  const g0 = p.layer();
  svgEl("circle", { cx: p.X(0), cy: p.Y(0), r: p.k, fill: "none", stroke: "#ccc", "stroke-width": 1.5, "stroke-dasharray": "4 6" }, g0);
  arrow(p, g0, COL.faint, 3, "", 0.45).set([0, 0], [1, 0]);
  arrow(p, g0, COL.faint, 3, "", 0.45).set([0, 0], [0, 1]);
  const gF = p.layer();
  const le1 = label(gF, "e₁", COL.faint, 22), le2 = label(gF, "e₂", COL.faint, 22);
  le1(p.X(1) + 8, p.Y(0) + 24); le2(p.X(0) + 26, p.Y(1) + 6);
  const arc = svgEl("path", { fill: "none", stroke: "#444", "stroke-width": 2.5 }, p.layer());
  const gV = p.layer();
  const c1 = arrow(p, gV, COL.c1, 5.5), c2 = arrow(p, gV, COL.c2, 5.5);
  const gL = p.layer();
  const l1 = label(gL, "R(θ)e₁", COL.c1, 24), l2 = label(gL, "R(θ)e₂", COL.c2, 24), lt = label(gL, "θ", "#333", 24);
  const gH = p.layer();
  const h1 = handle(gH, COL.c1), h2 = handle(gH, COL.c2);
  const toDeg = (x: number, y: number, off: number) => {
    let d = Math.round(Math.atan2(y, x) * 180 / Math.PI - off);
    while (d > 180) d -= 360; while (d <= -180) d += 360;
    return d;
  };
  draggable(h1, p.world, (x, y) => { th = toDeg(x, y, 0); ts.set(th); draw(); });
  draggable(h2, p.world, (x, y) => { th = toDeg(x, y, 90); ts.set(th); draw(); });

  const stack = isStack(host);
  const panel = htmlEl("div", "qb-panel", "", host);
  const row = stack ? htmlEl("div", "vm-row", "", panel) : panel;   // stack: slider and matrix side by side
  const ts = slider(row, "θ", -180, 180, 1, t0, v => { th = v; draw(); }, v => `${fmt(v)}°`);
  // the symbolic matrix only in the default layout (no room under a stacked plot)
  const sym = htmlEl("div", "vm-mat vm-sym", "", stack ? undefined : panel);
  sym.innerHTML = `<span>R(θ) =</span><span class="vm-br"><span style="color:${COL.c1}">cos θ</span>` +
    `<span style="color:${COL.c2}">−sin θ</span><span style="color:${COL.c1}">sin θ</span>` +
    `<span style="color:${COL.c2}">cos θ</span></span>`;
  const mat = htmlEl("div", "vm-mat", "", row);
  htmlEl("span", "", "R(θ) =", mat);
  const br = htmlEl("span", "vm-br", "", mat);
  const cells = [0, 1, 2, 3].map(i => { const c = htmlEl("span", "", "", br); c.style.color = i % 2 === 0 ? COL.c1 : COL.c2; return c; });
  addReset(host, p, panel, () => { th = t0; ts.set(t0); draw(); });

  function draw(): void {
    const [e1, e2] = rotCols(th);
    c1.set([0, 0], e1); c2.set([0, 0], e2);
    place(p, h1, e1); place(p, h2, e2);
    l1(...beyond(p, [0, 0], e1, 54)); l2(...beyond(p, [0, 0], e2, 54));
    const t = th * Math.PI / 180, R = 0.3, n = 40, pts: string[] = [];
    for (let i = 0; i <= n; i++) { const s = t * i / n; pts.push(`${p.X(R * Math.cos(s)).toFixed(1)},${p.Y(R * Math.sin(s)).toFixed(1)}`); }
    arc.setAttribute("d", "M" + pts.join(" L"));
    arc.style.display = Math.abs(th) < 3 ? "none" : "";
    lt(p.X(0.43 * Math.cos(t / 2)), p.Y(0.43 * Math.sin(t / 2)));
    [e1[0], e2[0], e1[1], e2[1]].forEach((x, i) => (cells[i].textContent = fmtFixed(x)));
  }
  draw();
}

autoMount(NAME, mount);
