// Dot product, cosine and projection. Two expression profiles u and v (2 genes) drawn
// as arrows; drag their tips. Shows u·v written out, lengths, cos θ, angle, the
// distance |u − v|, and the projection of u onto v. A "sequencing depth" slider
// scales v → k·v: the distance changes, the cosine does not.
// Auto-mounts on <div data-demo="dotproduct">. Optional: data-u="3 2" data-v="1 4".
import { svgEl, htmlEl, slider, presets, checkbox, draggable, svgPoint, scale, numList, autoMount } from "../lib/ui";
import { V2, stats, snap, fmt, fmtP, mul } from "./math";

const NAME = "dotproduct";
let uid = 0;
const STYLE = `
.qb-demo[data-demo="${NAME}"] .qb-plot { flex: 0 1 460px; max-width: 460px; overflow: hidden; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-plot { flex: 0 0 540px; width: 540px; height: 540px; max-width: none; max-height: none; }
.reveal .qb-demo[data-demo="${NAME}"] { flex-wrap: nowrap; }
.qb-demo[data-demo="${NAME}"] .qb-panel { flex: 1 1 380px; max-width: 640px; gap: .45em; }
.qb-demo[data-demo="${NAME}"] .dp-u { color: var(--qb-c1); font-weight: 600; }
.qb-demo[data-demo="${NAME}"] .dp-v { color: var(--qb-c4); font-weight: 600; }
.qb-demo[data-demo="${NAME}"] .dp-sign { font-weight: 600; padding: .25em .6em; border-radius: 6px; color: #fff; }
.qb-demo[data-demo="${NAME}"] .dp-depth { display: grid; grid-template-columns: auto auto 1fr; gap: .1em .7em;
  align-items: baseline; border: 2px solid #ccc; border-radius: 6px; padding: .35em .6em; }
.qb-demo[data-demo="${NAME}"] .dp-depth .val { font-family: ui-monospace, monospace; font-size: 1.2em; font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .dp-depth .ref { font-size: .8em; color: var(--qb-muted); }
.qb-demo[data-demo="${NAME}"] .dp-depth .changed { color: var(--qb-c2); }
.qb-demo[data-demo="${NAME}"] .dp-depth .same { color: var(--qb-c3); }
.qb-demo[data-demo="${NAME}"] .qb-readout { line-height: 1.45; }
.reveal .qb-demo[data-demo="${NAME}"] { font-size: 20px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-readout { font-size: 18px; }
.reveal .qb-demo[data-demo="${NAME}"] .dp-sign { font-size: 19px; }
`;

const COL = { u: "#1f77b4", v: "#ff7f0e", pos: "#2ca02c", zero: "#7f7f7f", neg: "#d62728" };

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function mount(host: HTMLElement): void {
  injectStyle();
  const u0 = numList(host.dataset.u, [3, 2]).slice(0, 2) as V2;
  const v0 = numList(host.dataset.v, [1, 4]).slice(0, 2) as V2;
  const st = { u: [...u0] as V2, v: [...v0] as V2, k: 1, step: 0.5 };  // v = profile at depth 1

  // ---- plot ----
  const W = 540, LO = -4, HI = 9, PAD = 20;
  const sx = scale(LO, HI, PAD, W - PAD), sy = scale(LO, HI, W - PAD, PAD);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${W}`, class: "qb-plot", role: "img",
    "aria-label": "Two vectors u and v with the projection of u onto v" }, host);
  const grid = svgEl("g", {}, svg);
  for (let i = LO; i <= HI; i++) {
    const cls = i === 0 ? "axis" : "grid";
    svgEl("line", { x1: sx(i), y1: sy(LO), x2: sx(i), y2: sy(HI), class: cls, "stroke-width": i === 0 ? 2 : 1 }, grid);
    svgEl("line", { x1: sx(LO), y1: sy(i), x2: sx(HI), y2: sy(i), class: cls, "stroke-width": i === 0 ? 2 : 1 }, grid);
    if (i !== 0 && i % 2 === 0) {
      svgEl("text", { x: sx(i), y: sy(0) + 20, "text-anchor": "middle", "font-size": 18, fill: "#666" }, grid).textContent = String(i);
      svgEl("text", { x: sx(0) - 7, y: sy(i) + 6, "text-anchor": "end", "font-size": 18, fill: "#666" }, grid).textContent = String(i);
    }
  }
  svgEl("text", { x: sx(HI) - 4, y: sy(0) - 8, "text-anchor": "end", "font-size": 18 }, grid).textContent = "gene 1";
  svgEl("text", { x: sx(0) + 8, y: sy(HI) + 18, "font-size": 18 }, grid).textContent = "gene 2";

  const clipId = `${NAME}-clip-${++uid}`;
  const cp = svgEl("clipPath", { id: clipId }, svgEl("defs", {}, svg));
  svgEl("rect", { x: sx(LO), y: sy(HI), width: sx(HI) - sx(LO), height: sy(LO) - sy(HI) }, cp);
  const lay = svgEl("g", { "clip-path": `url(#${clipId})` }, svg);
  const vLine = svgEl("line", { stroke: "#bbb", "stroke-width": 1.5, "stroke-dasharray": "2 5" }, lay);
  const distLine = svgEl("line", { stroke: "#555", "stroke-width": 2.5, "stroke-dasharray": "3 5" }, lay);
  const distLab = svgEl("text", { "font-size": 18, fill: "#444", "text-anchor": "middle" }, lay);
  const arc = svgEl("path", { fill: "none", stroke: "#555", "stroke-width": 2 }, lay);
  const arcLab = svgEl("text", { "font-size": 20, "text-anchor": "middle", "dominant-baseline": "middle" }, lay);
  const perp = svgEl("line", { "stroke-width": 2.5, "stroke-dasharray": "7 5" }, lay);
  const rightMark = svgEl("path", { fill: "none", "stroke-width": 2 }, lay);
  const ghost = mkArrow(lay, COL.v, 3, 0.35);
  const projA = mkArrow(lay, COL.pos, 9, 0.75);
  const vA = mkArrow(lay, COL.v, 4.5, 1);
  const uA = mkArrow(lay, COL.u, 4.5, 1);
  const projLab = svgEl("text", { "font-size": 19, "font-weight": 600, "text-anchor": "middle" }, lay);
  const uLab = svgEl("text", { "font-size": 22, "font-weight": 700, fill: COL.u, "text-anchor": "middle", "dominant-baseline": "middle" }, lay);
  const vLab = svgEl("text", { "font-size": 22, "font-weight": 700, fill: COL.v, "text-anchor": "middle", "dominant-baseline": "middle" }, lay);
  const vH = svgEl("circle", { r: 15, class: "handle", stroke: COL.v }, lay);
  const uH = svgEl("circle", { r: 15, class: "handle", stroke: COL.u }, lay);

  const toWorld = (ev: PointerEvent): [number, number] => {
    const [px, py] = svgPoint(svg, ev);
    const c = (t: number) => Math.max(LO + 0.2, Math.min(HI - 0.2, t));
    return [c(sx.invert(px)), c(sy.invert(py))];
  };
  draggable(uH, toWorld, (x, y) => {
    const p: V2 = [snap(x, st.step), snap(y, st.step)];
    if (p[0] === 0 && p[1] === 0) return;
    st.u = p; clearPresets(); draw();
  });
  draggable(vH, toWorld, (x, y) => {
    // the handle sits at the shown tip k·v; snap that tip, then store v = tip / k
    const p: V2 = [snap(x, st.step), snap(y, st.step)];
    if (p[0] === 0 && p[1] === 0) return;
    st.v = [p[0] / st.k, p[1] / st.k]; clearPresets(); draw();
  });

  // ---- panel ----
  const panel = htmlEl("div", "qb-panel", "", host);
  const btns = presets(panel, [
    { label: "lecture", apply: () => setUV([3, 2], [1, 4]) },
    { label: "perpendicular", apply: () => setUV([2, 0], [0, 5]) },
    { label: "parallel", apply: () => setUV([3, 4], [6, 8]) },
    { label: "opposite", apply: () => setUV([3, 1], [-3, -1]) },
    { label: "obtuse", apply: () => setUV([3, 1], [-2, 3]) },
    { label: "x-axis shadow", apply: () => setUV([3, 3], [4, 0]) },
  ]);
  const clearPresets = () => btns.forEach(b => b.classList.remove("active"));
  const kS = slider(panel, "sequencing depth of v: k", 0.25, 2.5, 0.05, 1, k => { st.k = k; draw(); }, k => k.toFixed(2));
  checkbox(panel, "snap tips to a 0.5 grid", true, on => { st.step = on ? 0.5 : 0; });
  const depth = htmlEl("div", "dp-depth", "", panel);
  const sign = htmlEl("div", "dp-sign", "", panel);
  const ro = htmlEl("div", "qb-readout", "", panel);

  function setUV(u: V2, v: V2): void {
    st.u = [...u] as V2; st.v = [...v] as V2; st.k = 1; kS.set(1); draw();
  }

  function draw(): void {
    const u = st.u, v = mul(st.k, st.v);
    const s = stats(u, v), s1 = stats(u, st.v);
    const signCol = s.sign > 0 ? COL.pos : s.sign < 0 ? COL.neg : COL.zero;

    // line through v, distance segment, arrows
    const L = 30 / Math.max(s.nv, 1e-9);
    setLine(vLine, [-L * v[0], -L * v[1]], [L * v[0], L * v[1]]);
    setLine(distLine, u, v);
    const mid: V2 = [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    distLab.setAttribute("x", String(sx(mid[0]) + 10)); distLab.setAttribute("y", String(sy(mid[1]) - 10));
    distLab.textContent = "|u − v|";
    setArrow(uA, [0, 0], u);
    setArrow(vA, [0, 0], v);
    setArrow(ghost, [0, 0], st.v);
    ghost.g.style.display = Math.abs(st.k - 1) > 1e-9 ? "" : "none";
    placeLabel(uLab, u, "u"); placeLabel(vLab, v, "v");
    for (const [h, p] of [[uH, u], [vH, v]] as const) { h.setAttribute("cx", String(sx(p[0]))); h.setAttribute("cy", String(sy(p[1]))); }

    // angle arc
    const a1 = Math.atan2(u[1], u[0]), a2 = Math.atan2(v[1], v[0]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
    const R = 0.9, n = 24, pts: string[] = [];
    for (let i = 0; i <= n; i++) { const t = a1 + d * i / n; pts.push(`${sx(R * Math.cos(t))},${sy(R * Math.sin(t))}`); }
    arc.setAttribute("d", "M" + pts.join(" L"));
    const am = a1 + d / 2;
    arcLab.setAttribute("x", String(sx(1.45 * Math.cos(am)))); arcLab.setAttribute("y", String(sy(1.45 * Math.sin(am))));
    arcLab.textContent = "θ";

    // projection of u onto v, the perpendicular drop, and a right-angle mark
    const p = s.proj ?? [0, 0];
    setArrow(projA, [0, 0], p);
    projA.g.style.display = Math.hypot(p[0], p[1]) > 0.05 ? "" : "none";
    for (const e of [projA.line, projA.head]) e.setAttribute(e === projA.head ? "fill" : "stroke", signCol);
    setLine(perp, u, p);
    perp.setAttribute("stroke", signCol);
    const off = Math.hypot(u[0] - p[0], u[1] - p[1]);
    if (off > 0.3 && s.nv > 0) {
      const e1 = mul(0.35 / s.nv, v), e2 = mul(0.35 / off, [u[0] - p[0], u[1] - p[1]]);
      const q = (a: V2) => `${sx(a[0])},${sy(a[1])}`;
      rightMark.setAttribute("d", `M${q([p[0] + e1[0], p[1] + e1[1]])} L${q([p[0] + e1[0] + e2[0], p[1] + e1[1] + e2[1]])} L${q([p[0] + e2[0], p[1] + e2[1]])}`);
      rightMark.setAttribute("stroke", signCol);
      rightMark.style.display = "";
    } else rightMark.style.display = "none";
    projLab.setAttribute("fill", signCol);
    // label the shadow on the far side of the line from u
    const nrm: V2 = s.nv > 0 ? [-v[1] / s.nv, v[0] / s.nv] : [0, 1];
    const side = (u[0] - p[0]) * nrm[0] + (u[1] - p[1]) * nrm[1] >= 0 ? -1 : 1;
    const pl: V2 = [p[0] / 2 + side * 0.65 * nrm[0], p[1] / 2 + side * 0.65 * nrm[1]];
    projLab.setAttribute("x", String(sx(pl[0]))); projLab.setAttribute("y", String(sy(pl[1]) + 6));
    projLab.textContent = Math.hypot(p[0], p[1]) > 0.05 ? "proj" : "";

    // ---- readouts ----
    const U = (t: string) => `<span class="dp-u">${t}</span>`, Vv = (t: string) => `<span class="dp-v">${t}</span>`;
    const vec = (a: V2) => `(${fmt(a[0])}, ${fmt(a[1])})`;
    const kTxt = st.k === 1 ? "" : `  (= ${fmt(st.k)}·${vec(st.v)})`;
    const cosT = (c: number | null) => c === null ? "undefined" : (Math.abs(c) < 5e-4 ? 0 : c).toFixed(3).replace("-", "−");
    ro.innerHTML = [
      `${U("u")} = ${vec(u)}    ${Vv("v")} = ${vec(v)}${kTxt}`,
      `u·v = ${fmtP(u[0])}·${fmtP(v[0])} + ${fmtP(u[1])}·${fmtP(v[1])} = <b>${fmt(s.dot)}</b>`,
      `‖u‖ = ${fmt(s.nu)}    ‖v‖ = ${fmt(s.nv)}`,
      `cos θ = u·v/(‖u‖‖v‖) = ${fmt(s.dot)}/(${fmt(s.nu)}·${fmt(s.nv)}) = ${cosT(s.cos)}`,
      `θ = ${s.deg === null ? "–" : fmt(s.deg, 1) + "°"}`,
      s.coef === null ? "proj: v = 0" :
        `proj<sub>v</sub>u = (u·v / v·v)·v = (${fmt(s.dot)}/${fmt(s.nv * s.nv)})·v\n        = ${fmt(s.coef, 3)}·${vec(v)} = <b>${vec(s.proj!)}</b>`,
    ].join("\n");
    sign.style.background = signCol;
    sign.textContent = s.sign > 0 ? "u·v > 0: same general direction (θ < 90°)"
      : s.sign < 0 ? "u·v < 0: opposing directions (θ > 90°)"
      : "u·v = 0: perpendicular (θ = 90°), no shadow";
    const ch = (a: number, b: number) => Math.abs(a - b) > 0.005 * Math.max(1, Math.abs(b)) ? "changed" : "same";
    const cosCls = s.cos === null || s1.cos === null ? "same" : ch(s.cos, s1.cos);
    depth.innerHTML =
      `<span>distance ‖u − v‖</span><span class="val ${ch(s.dist, s1.dist)}">${fmt(s.dist)}</span><span class="ref">(k = 1: ${fmt(s1.dist)})</span>` +
      `<span>cosine cos θ</span><span class="val ${cosCls}">${cosT(s.cos)}</span><span class="ref">(k = 1: ${cosT(s1.cos)})</span>`;
  }

  function setLine(l: SVGLineElement, a: V2, b: V2): void {
    l.setAttribute("x1", String(sx(a[0]))); l.setAttribute("y1", String(sy(a[1])));
    l.setAttribute("x2", String(sx(b[0]))); l.setAttribute("y2", String(sy(b[1])));
  }
  function placeLabel(t: SVGTextElement, p: V2, txt: string): void {
    const n = Math.hypot(p[0], p[1]) || 1;
    const q: V2 = [p[0] + 0.75 * p[0] / n, p[1] + 0.75 * p[1] / n];
    t.setAttribute("x", String(sx(q[0]))); t.setAttribute("y", String(sy(q[1])));
    t.textContent = txt;
  }
  function setArrow(a: Arrow, from: V2, to: V2): void {
    const x0 = sx(from[0]), y0 = sy(from[1]), x1 = sx(to[0]), y1 = sy(to[1]);
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const hl = Math.min(18 + a.w, len * 0.6), hw = 7 + a.w * 0.8;
    const bx = x1 - ux * hl, by = y1 - uy * hl;
    setAttrsN(a.line, { x1: x0, y1: y0, x2: bx, y2: by });
    a.head.setAttribute("points", `${x1},${y1} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`);
  }

  draw();
}

interface Arrow { g: SVGGElement; line: SVGLineElement; head: SVGPolygonElement; w: number }
function mkArrow(parent: Element, col: string, w: number, op: number): Arrow {
  const g = svgEl("g", { opacity: op }, parent);
  const line = svgEl("line", { stroke: col, "stroke-width": w, "stroke-linecap": "round" }, g);
  const head = svgEl("polygon", { fill: col }, g);
  return { g, line, head, w };
}
function setAttrsN(e: Element, a: Record<string, number>): void {
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v));
}

autoMount(NAME, mount);
