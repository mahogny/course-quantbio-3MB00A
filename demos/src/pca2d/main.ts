// PCA in 2D. Auto-mounts on <div data-demo="pca2d">.
//  data-mode="rotate"   (default) turn a candidate axis through the cloud; see the projections
//                       and the share of variance it captures; reveal PC1/PC2.
//  data-mode="pitfalls" presets: units/scaling, an outlier, two groups PCA does not separate.
//  data-points="1 5 3 3 ..."  (rotate mode) x y pairs; default: the lecture's 5 samples.
//  data-preset="units|outlier|groups"  (pitfalls mode) the preset shown first.
import { autoMount, button, checkbox, draggable, htmlEl, presets, slider, svgEl, svgPoint, numList, setAttrs } from "../lib/ui";
import { cov, pca, varAlong, standardise, score, axisDeg, type Pt } from "./pca";
import { LECTURE, cloud30, units, outlierCloud, OUTLIER_START, groups } from "./data";

const NAME = "pca2d";
let uid = 0;

function injectStyle(): void {
  if (document.getElementById("pca2d-style")) return;
  const s = document.createElement("style");
  s.id = "pca2d-style";
  s.textContent = `
[data-demo="pca2d"].qb-demo { flex-wrap: wrap; }
.qb-demo[data-demo="pca2d"] .qb-plot { flex: 1 1 360px; max-width: 540px; }
.reveal .qb-demo[data-demo="pca2d"] { flex-wrap: nowrap; gap: 28px; }
.reveal .qb-demo[data-demo="pca2d"] .qb-plot { flex: 0 0 540px; width: 540px; max-width: 540px; }
.qb-demo[data-demo="pca2d"] .qb-panel { flex: 1 1 320px; max-width: 540px; }
.reveal .qb-demo[data-demo="pca2d"] .qb-panel { flex: 1 1 520px; max-width: 580px; }
[data-demo="pca2d"] .pca2d-bar { position: relative; height: 22px; background: var(--qb-grid); border-radius: 4px; }
[data-demo="pca2d"] .pca2d-bar .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--qb-c3); }
[data-demo="pca2d"] .pca2d-bar .mark { position: absolute; top: -4px; bottom: -4px; width: 4px; margin-left: -2px; background: var(--qb-c2); }
[data-demo="pca2d"] .pca2d-row { display: flex; justify-content: space-between; align-items: baseline; gap: .6em; }
[data-demo="pca2d"] .pca2d-pct { font-size: 1.5em; font-weight: 700; color: var(--qb-c3); font-variant-numeric: tabular-nums; }
[data-demo="pca2d"] .pca2d-pc { color: var(--qb-c2); font-weight: 600; }
[data-demo="pca2d"] .pca2d-btns { display: flex; flex-wrap: wrap; gap: .35em; }
[data-demo="pca2d"] .pca2d-hidden { display: none; }
[data-demo="pca2d"] svg .pt { fill: var(--qb-c1); stroke: #fff; stroke-width: 1.5; }
[data-demo="pca2d"] svg .proj { stroke: var(--qb-muted); stroke-width: 1.5; stroke-dasharray: 4 4; }
[data-demo="pca2d"] svg .foot { fill: var(--qb-c4); stroke: #fff; stroke-width: 1; }
[data-demo="pca2d"] svg .cand { stroke: var(--qb-c3); stroke-width: 4; }
[data-demo="pca2d"] svg .pc1 { stroke: var(--qb-c2); stroke-width: 4; }
[data-demo="pca2d"] svg .pc2 { stroke: var(--qb-c2); stroke-width: 3; stroke-dasharray: 10 7; }
[data-demo="pca2d"] svg .ghost { stroke: #999; stroke-width: 3; stroke-dasharray: 8 6; }
[data-demo="pca2d"] svg .meanmark { stroke: var(--qb-fg); stroke-width: 2.5; }
[data-demo="pca2d"] svg .tick { font-size: 18px; fill: var(--qb-muted); }
[data-demo="pca2d"] svg .lab { font-size: 20px; }
[data-demo="pca2d"] svg .lab-pc { font-size: 22px; font-weight: 700; fill: var(--qb-c2); }
[data-demo="pca2d"] svg .lab-cand { font-size: 20px; font-weight: 700; fill: var(--qb-c3); }
[data-demo="pca2d"] svg .strip { fill: var(--qb-panel); stroke: var(--qb-grid); }
`;
  document.head.appendChild(s);
}

/** Equal-aspect world <-> SVG pixel mapping, centred at (cx, cy). */
class Frame {
  constructor(public cx: number, public cy: number, public ppu: number) {}
  px(p: Pt): Pt { return [this.cx + p[0] * this.ppu, this.cy - p[1] * this.ppu]; }
  world(x: number, y: number): Pt { return [(x - this.cx) / this.ppu, (this.cy - y) / this.ppu]; }
}

/** A "nice" grid step (1, 2 or 5 times a power of ten) giving roughly `target` steps over `span`. */
function niceStep(span: number, target: number): number {
  const raw = span / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function fmtNum(v: number): string {
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return s.replace("-", "−");
}
function fmtPct(f: number): string {
  const p = 100 * f;
  return (p > 99.5 && p < 100 ? p.toFixed(2) : p < 1 && p > 0 ? p.toFixed(2) : p.toFixed(0)) + "%";
}

/** Grid lines, tick labels and axis names inside the rectangle [x0,x1]×[y0,y1] (pixels). */
function drawGrid(g: SVGGElement, f: Frame, x0: number, y0: number, x1: number, y1: number,
  xName: string, yName: string): void {
  g.replaceChildren();
  const [wx0, wy1] = f.world(x0, y0), [wx1, wy0] = f.world(x1, y1);
  const step = niceStep(Math.max(wx1 - wx0, wy1 - wy0), 8);
  const ticksEvery = (Math.max(wx1 - wx0, wy1 - wy0) / step) > 7 ? 2 : 1;
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const tk = (v: number) => v.toFixed(dec).replace("-", "−");
  for (let k = Math.ceil(wx0 / step); k * step <= wx1; k++) {
    const [px] = f.px([k * step, 0]);
    svgEl("line", { x1: px, y1: y0, x2: px, y2: y1, class: k === 0 ? "axis" : "grid" }, g);
    if (k !== 0 && k % ticksEvery === 0 && px > x0 + 15 && px < x1 - 15)
      svgEl("text", { x: px, y: y1 - 6, "text-anchor": "middle", class: "tick" }, g).textContent = tk(k * step);
  }
  for (let k = Math.ceil(wy0 / step); k * step <= wy1; k++) {
    const [, py] = f.px([0, k * step]);
    svgEl("line", { x1: x0, y1: py, x2: x1, y2: py, class: k === 0 ? "axis" : "grid" }, g);
    if (k !== 0 && k % ticksEvery === 0 && py > y0 + 15 && py < y1 - 30)
      svgEl("text", { x: x0 + 5, y: py - 4, class: "tick" }, g).textContent = tk(k * step);
  }
  const [ox] = f.px([0, 0]);
  svgEl("text", { x: x1 - 6, y: y1 - 30, "text-anchor": "end", class: "lab" }, g).textContent = xName;
  svgEl("text", { x: Math.max(ox, x0) + 8, y: y0 + 22, class: "lab" }, g).textContent = yName;
}

/** A line through m along angle theta, long enough to cross the whole plot. */
function setAxisLine(line: SVGLineElement, f: Frame, m: Pt, theta: number, L = 1e4): void {
  const u: Pt = [Math.cos(theta), Math.sin(theta)];
  const a = f.px([m[0] - L * u[0], m[1] - L * u[1]]), b = f.px([m[0] + L * u[0], m[1] + L * u[1]]);
  setAttrs(line, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
}

/** Intersection distance from m along u to the rectangle edge (world units), minus a margin. */
function reach(f: Frame, m: Pt, u: Pt, x0: number, y0: number, x1: number, y1: number, marginPx: number): number {
  const [mx, my] = f.px(m);
  const dx = u[0], dy = -u[1];
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (x1 - marginPx - mx) / dx);
  if (dx < -1e-9) t = Math.min(t, (x0 + marginPx - mx) / dx);
  if (dy > 1e-9) t = Math.min(t, (y1 - marginPx - my) / dy);
  if (dy < -1e-9) t = Math.min(t, (y0 + marginPx - my) / dy);
  return Math.max(0, t) / f.ppu;
}

function bar(parent: Element): { fill: HTMLDivElement; mark: HTMLDivElement; set(frac: number, mark?: number): void } {
  const b = htmlEl("div", "pca2d-bar", "", parent);
  const fill = htmlEl("div", "fill", "", b);
  const mark = htmlEl("div", "mark", "", b);
  return {
    fill, mark,
    set(frac: number, m?: number) {
      fill.style.width = (100 * Math.max(0, Math.min(1, frac))) + "%";
      if (m === undefined) mark.style.display = "none";
      else { mark.style.display = ""; mark.style.left = (100 * m) + "%"; }
    },
  };
}

function meanMark(g: SVGGElement): { set(p: Pt): void } {
  const a = svgEl("line", { class: "meanmark" }, g), b = svgEl("line", { class: "meanmark" }, g);
  return {
    set([x, y]: Pt) {
      setAttrs(a, { x1: x - 9, y1: y, x2: x + 9, y2: y });
      setAttrs(b, { x1: x, y1: y - 9, x2: x, y2: y + 9 });
    },
  };
}

// ---------------------------------------------------------------------------
// Mode "rotate"
// ---------------------------------------------------------------------------
function mountRotate(host: HTMLElement): void {
  const W = 560, H = 560;
  const id = `pca2d-clip-${++uid}`;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "Data cloud with a rotatable axis and perpendicular projections" });
  const clip = svgEl("clipPath", { id }, svgEl("defs", {}, svg));
  svgEl("rect", { x: 0, y: 0, width: W, height: H }, clip);
  const gGrid = svgEl("g", {}, svg);
  const gLines = svgEl("g", { "clip-path": `url(#${id})` }, svg);
  const pc2Line = svgEl("line", { class: "pc2" }, gLines);
  const pc1Line = svgEl("line", { class: "pc1" }, gLines);
  const candLine = svgEl("line", { class: "cand" }, gLines);
  const gProj = svgEl("g", {}, svg);
  const gFeet = svgEl("g", {}, svg);
  const mm = meanMark(svgEl("g", {}, svg));
  const gPts = svgEl("g", {}, svg);
  const gLabels = svgEl("g", {}, svg);
  const pc1Lab = svgEl("text", { class: "lab-pc", "text-anchor": "middle" }, gLabels);
  const pc2Lab = svgEl("text", { class: "lab-pc", "text-anchor": "middle" }, gLabels);
  const candLab = svgEl("text", { class: "lab-cand", "text-anchor": "middle" }, gLabels);
  const gHandles = svgEl("g", {}, svg);
  const handles = [0, 1].map(() => svgEl("circle", { r: 16, class: "handle", stroke: "var(--qb-c3)" }, gHandles));

  const attrPts = numList(host.dataset.points, []);
  const custom: Pt[] = [];
  for (let i = 0; i + 1 < attrPts.length; i += 2) custom.push([attrPts[i], attrPts[i + 1]]);
  const datasets: { label: string; raw: Pt[]; names: boolean }[] = [
    { label: custom.length >= 2 ? `${custom.length} samples` : "5 samples (lecture)", raw: custom.length >= 2 ? custom : LECTURE, names: true },
    { label: "30 samples", raw: cloud30(), names: false },
  ];

  const startDeg = Number(host.dataset.angle ?? 20);
  let ds = 0;
  let pts: Pt[] = [];
  let theta = (startDeg * Math.PI) / 180;
  let showPC = false;
  let f = new Frame(W / 2, H / 2, 1);

  // ---- panel ----
  const panel = htmlEl("div", "qb-panel");
  const presetBtns = presets(panel, datasets.map((d, i) => ({ label: d.label, apply: () => load(i) })));
  const sl = slider(panel, "Axis angle", 0, 179, 1, startDeg, v => { theta = (v * Math.PI) / 180; draw(); }, v => `${v.toFixed(0)}°`);
  const r1 = htmlEl("div", "pca2d-row", "", panel);
  htmlEl("span", "", "Variance captured along the axis", r1);
  const pct = htmlEl("span", "pca2d-pct", "", r1);
  const capBar = bar(panel);
  const ro = htmlEl("div", "qb-readout", "", panel);
  const pcBox = htmlEl("div", "qb-readout pca2d-pc", "", panel);
  const btns = htmlEl("div", "pca2d-btns", "", panel);
  const showBox = checkbox(btns, "Show PC1 and PC2", false, v => { showPC = v; draw(); });
  button(btns, "Turn to PC1", () => {
    theta = pca(cov(pts)).theta1;
    if (theta < 0) theta += Math.PI;
    sl.set(Math.round(axisDeg(theta)));
    draw();
  });
  button(btns, "Reset", () => { showBox.checked = false; showPC = false; load(ds); });
  htmlEl("div", "qb-note", "Drag a white handle (or the slider) to turn the green axis. Drag a point to move it.", panel);

  host.append(svg, panel);

  let ptEls: { c: SVGCircleElement; proj: SVGLineElement; foot: SVGCircleElement; lab?: SVGTextElement }[] = [];

  function load(i: number): void {
    ds = i;
    presetBtns.forEach((b, k) => b.classList.toggle("active", k === i));
    const c0 = cov(datasets[i].raw);
    pts = datasets[i].raw.map(([x, y]) => [x - c0.mx, y - c0.my] as Pt);   // centred
    const R = Math.max(...pts.map(p => Math.hypot(p[0], p[1]))) * 1.2 + 0.4;
    f = new Frame(W / 2, H / 2, (W / 2 - 10) / R);
    drawGrid(gGrid, f, 0, 0, W, H, "GENE_A (centred)", "GENE_B (centred)");
    theta = (startDeg * Math.PI) / 180;
    sl.set(startDeg);
    gProj.replaceChildren(); gFeet.replaceChildren(); gPts.replaceChildren();
    ptEls = pts.map((_, k) => {
      const proj = svgEl("line", { class: "proj" }, gProj);
      const foot = svgEl("circle", { r: 7, class: "foot" }, gFeet);
      const c = svgEl("circle", { r: datasets[i].names ? 11 : 8, class: "pt" }, gPts);
      const lab = datasets[i].names ? svgEl("text", { class: "lab" }, gPts) : undefined;
      if (lab) lab.textContent = `s${k + 1}`;
      draggable(c, ev => f.world(...svgPoint(svg, ev)), (x, y) => {
        const lim = (W / 2 - 12) / f.ppu;
        pts[k] = [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, y))];
        draw();
      });
      return { c, proj, foot, lab };
    });
    draw();
  }

  handles.forEach((h, k) => draggable(h, ev => f.world(...svgPoint(svg, ev)), (x, y) => {
    const c = cov(pts);
    let t = Math.atan2(y - c.my, x - c.mx) + (k === 1 ? Math.PI : 0);
    let deg = Math.round(axisDeg(t));
    if (deg === 180) deg = 0;
    theta = (deg * Math.PI) / 180;
    sl.set(deg);
    draw();
  }));

  function draw(): void {
    const c = cov(pts);
    const m: Pt = [c.mx, c.my];
    const res = pca(c);
    const u: Pt = [Math.cos(theta), Math.sin(theta)];
    setAxisLine(candLine, f, m, theta);
    pts.forEach((p, k) => {
      const s = score(p, m, theta);
      const foot: Pt = [m[0] + s * u[0], m[1] + s * u[1]];
      const P = f.px(p), F = f.px(foot);
      setAttrs(ptEls[k].c, { cx: P[0], cy: P[1] });
      setAttrs(ptEls[k].proj, { x1: P[0], y1: P[1], x2: F[0], y2: F[1] });
      setAttrs(ptEls[k].foot, { cx: F[0], cy: F[1] });
      if (ptEls[k].lab) setAttrs(ptEls[k].lab!, { x: P[0] + 12, y: P[1] - 10 });
    });
    mm.set(f.px(m));
    // handles at both ends of the axis, inside the plot
    for (const [k, sgn] of [[0, 1], [1, -1]] as const) {
      const dir: Pt = [sgn * u[0], sgn * u[1]];
      const d = reach(f, m, dir, 0, 0, W, H, 22);
      setAttrs(handles[k], { cx: f.px([m[0] + d * dir[0], m[1] + d * dir[1]])[0], cy: f.px([m[0] + d * dir[0], m[1] + d * dir[1]])[1] });
    }
    {
      const d = reach(f, m, u, 0, 0, W, H, 22) * 0.78;
      const q = f.px([m[0] + d * u[0], m[1] + d * u[1]]);
      setAttrs(candLab, { x: q[0] + 22 * Math.sin(theta), y: q[1] + 22 * Math.cos(theta) + 7 });
      candLab.textContent = "axis";
    }
    // PCs
    for (const e of [pc1Line, pc2Line, pc1Lab, pc2Lab]) e.style.display = showPC ? "" : "none";
    if (showPC) {
      setAxisLine(pc1Line, f, m, res.theta1);
      setAxisLine(pc2Line, f, m, res.theta1 + Math.PI / 2);
      for (const [lab, t, txt] of [[pc1Lab, res.theta1, "PC1"], [pc2Lab, res.theta1 + Math.PI / 2, "PC2"]] as const) {
        const dir: Pt = [Math.cos(t), Math.sin(t)];
        const d = reach(f, m, dir, 0, 0, W, H, 34) * 0.95;
        const q = f.px([m[0] + d * dir[0], m[1] + d * dir[1]]);
        setAttrs(lab, { x: q[0] - 22 * Math.sin(t), y: q[1] - 22 * Math.cos(t) + 7 });
        lab.textContent = txt;
      }
    }
    // readouts
    const v = varAlong(c, theta);
    const frac = res.total > 0 ? v / res.total : 0;
    pct.textContent = fmtPct(frac);
    capBar.set(frac, showPC ? res.l1 / res.total : undefined);
    let txt = `along the axis:  ${fmtNum(v)}\n`
      + `perpendicular:   ${fmtNum(res.total - v)}\n`
      + `total variance:  ${fmtNum(res.total)}`;
    if (datasets[ds].names && pts.length <= 8) {
      txt += "\nscores on the axis:\n" + pts.map((p, k) => `s${k + 1}\u00a0${fmtNum(score(p, m, theta))}`).join("  ");
    }
    ro.textContent = txt;
    pcBox.style.display = showPC ? "" : "none";
    if (showPC) {
      pcBox.textContent = `PC1 at ${axisDeg(res.theta1).toFixed(0)}°: ${fmtNum(res.l1)} (${fmtPct(res.l1 / res.total)})\n`
        + `PC2 at ${axisDeg(res.theta1 + Math.PI / 2).toFixed(0)}°: ${fmtNum(res.l2)} (${fmtPct(res.l2 / res.total)})`;
    }
  }

  load(0);
}

// ---------------------------------------------------------------------------
// Mode "pitfalls"
// ---------------------------------------------------------------------------
type PresetName = "units" | "outlier" | "groups";

function mountPitfalls(host: HTMLElement): void {
  const W = 560, H = 560, PH = 400;            // scatter area 560×400, then two score strips
  const S1 = 412, S2 = 488, SH = 66;            // strip tops and height
  const id = `pca2d-clip-${++uid}`;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "Scatter plot with PC1 and PC2, and strips of the PC1 and PC2 scores" });
  const clip = svgEl("clipPath", { id }, svgEl("defs", {}, svg));
  svgEl("rect", { x: 0, y: 0, width: W, height: PH }, clip);
  const gGrid = svgEl("g", { "clip-path": `url(#${id})` }, svg);
  const gLines = svgEl("g", { "clip-path": `url(#${id})` }, svg);
  const ghost = svgEl("line", { class: "ghost" }, gLines);
  const pc2Line = svgEl("line", { class: "pc2" }, gLines);
  const pc1Line = svgEl("line", { class: "pc1" }, gLines);
  const mm = meanMark(svgEl("g", {}, svg));
  const gPts = svgEl("g", {}, svg);
  const pc1Lab = svgEl("text", { class: "lab-pc", "text-anchor": "middle" }, svg);
  const pc2Lab = svgEl("text", { class: "lab-pc", "text-anchor": "middle" }, svg);
  const outH = svgEl("circle", { r: 16, class: "handle", stroke: "var(--qb-c2)" }, svg);
  const outDot = svgEl("circle", { r: 8, fill: "var(--qb-c2)" }, svg);
  outDot.style.pointerEvents = "none";
  // strips
  const gStrip = svgEl("g", {}, svg);
  for (const [y, name] of [[S1, "PC1 scores"], [S2, "PC2 scores"]] as const) {
    svgEl("rect", { x: 0, y, width: W, height: SH, rx: 6, class: "strip" }, gStrip);
    svgEl("line", { x1: W / 2, y1: y + 4, x2: W / 2, y2: y + SH - 4, class: "grid" }, gStrip);
    svgEl("text", { x: 8, y: y + 21, class: "lab", "font-weight": 600 }, gStrip).textContent = name;
  }
  const gStripPts = svgEl("g", {}, svg);

  const colours = ["var(--qb-c1)", "var(--qb-c4)"];
  let preset: PresetName = (["units", "outlier", "groups"].includes(host.dataset.preset ?? "") ? host.dataset.preset : "units") as PresetName;
  let scaled = false;
  let raw: Pt[] = [];          // the data without the outlier
  let grp: number[] = [];
  let outlier: Pt = [...OUTLIER_START] as Pt;
  let f = new Frame(W / 2, PH / 2, 1);

  // ---- panel ----
  const panel = htmlEl("div", "qb-panel");
  const names: PresetName[] = ["units", "outlier", "groups"];
  const presetBtns = presets(panel, [
    { label: "1 · Units", apply: () => load("units") },
    { label: "2 · Outlier", apply: () => load("outlier") },
    { label: "3 · Two groups", apply: () => load("groups") },
  ]);
  const note = htmlEl("div", "qb-note", "", panel);
  const scaleWrap = htmlEl("div", "", "", panel);
  const scaleBox = checkbox(scaleWrap, "Scale variables (divide each by its SD)", false, v => { scaled = v; load(preset, false); });
  const r1 = htmlEl("div", "pca2d-row", "", panel);
  htmlEl("span", "pca2d-pc", "PC1 explains", r1);
  const pct1 = htmlEl("span", "pca2d-pct", "", r1);
  const bar1 = bar(panel);
  const r2 = htmlEl("div", "pca2d-row", "", panel);
  htmlEl("span", "pca2d-pc", "PC2 explains", r2);
  const pct2 = htmlEl("span", "pca2d-pct", "", r2);
  const bar2 = bar(panel);
  const ro = htmlEl("div", "qb-readout", "", panel);
  const btns = htmlEl("div", "pca2d-btns", "", panel);
  button(btns, "Reset", () => { scaled = false; scaleBox.checked = false; outlier = [...OUTLIER_START] as Pt; load(preset); });

  host.append(svg, panel);

  draggable(outH, ev => f.world(...svgPoint(svg, ev)), (x, y) => {
    const [lx0, ly1] = f.world(18, 18), [lx1, ly0] = f.world(W - 18, PH - 18);
    outlier = [Math.max(lx0, Math.min(lx1, x)), Math.max(ly0, Math.min(ly1, y))];
    draw();
  });

  let shown: Pt[] = [];        // plotted (world) coordinates of the non-outlier points
  let axisNames: [string, string] = ["", ""];
  let ptEls: SVGCircleElement[] = [], stripEls: SVGCircleElement[][] = [];

  function load(p: PresetName, resetScale = true): void {
    preset = p;
    presetBtns.forEach((b, k) => b.classList.toggle("active", names[k] === p));
    if (resetScale && p !== "units") { scaled = false; scaleBox.checked = false; }
    scaleWrap.classList.toggle("pca2d-hidden", p !== "units");
    grp = [];
    if (p === "units") {
      raw = units();
      note.textContent = "Metabolite A is in large raw intensities, B is a ratio. Same samples, very different units.";
      axisNames = scaled ? ["A / SD(A)", "B / SD(B)"] : ["A (raw intensity)", "B (ratio)"];
    } else if (p === "outlier") {
      raw = outlierCloud();
      note.textContent = "One unusual sample (red). Drag it. Grey dashed line: PC1 without it.";
      axisNames = ["gene 1", "gene 2"];
    } else {
      const g = groups();
      raw = g.pts; grp = g.grp;
      note.textContent = "Two groups (blue, orange). PCA never sees the colours. Compare the two score strips.";
      axisNames = ["gene 1", "gene 2"];
    }
    if (scaled) shown = standardise(raw).pts;
    else { const c0 = cov(raw); shown = raw.map(([x, y]) => [x - c0.mx, y - c0.my] as Pt); }
    // equal-aspect frame that fits the data (and the outlier's start)
    const all = p === "outlier" ? [...shown, OUTLIER_START] : shown;
    const mx = Math.max(...all.map(q => Math.abs(q[0]))) * 1.15, my = Math.max(...all.map(q => Math.abs(q[1]))) * 1.15;
    f = new Frame(W / 2, PH / 2, Math.min((W / 2 - 10) / mx, (PH / 2 - 10) / my));
    drawGrid(gGrid, f, 0, 0, W, PH, axisNames[0], axisNames[1]);
    gPts.replaceChildren(); gStripPts.replaceChildren();
    ptEls = shown.map((_, k) => svgEl("circle", { r: 7, class: "pt", style: `fill:${colours[grp[k] ?? 0]}` }, gPts));
    const n = shown.length + (p === "outlier" ? 1 : 0);
    stripEls = [0, 1].map(() => Array.from({ length: n }, (_, k) => svgEl("circle", {
      r: 6, "fill-opacity": 0.75,
      fill: k >= shown.length ? "var(--qb-c2)" : colours[grp[k] ?? 0],
    }, gStripPts)));
    for (const e of [outH, outDot, ghost]) e.style.display = p === "outlier" ? "" : "none";
    draw();
  }

  function draw(): void {
    const data: Pt[] = preset === "outlier" ? [...shown, outlier] : shown;
    const c = cov(data);
    const m: Pt = [c.mx, c.my];
    const res = pca(c);
    shown.forEach((q, k) => { const P = f.px(q); setAttrs(ptEls[k], { cx: P[0], cy: P[1] }); });
    if (preset === "outlier") {
      const P = f.px(outlier);
      setAttrs(outH, { cx: P[0], cy: P[1] }); setAttrs(outDot, { cx: P[0], cy: P[1] });
      const c0 = cov(shown);
      setAxisLine(ghost, f, [c0.mx, c0.my], pca(c0).theta1);
    }
    mm.set(f.px(m));
    setAxisLine(pc1Line, f, m, res.theta1);
    setAxisLine(pc2Line, f, m, res.theta1 + Math.PI / 2);
    for (const [lab, t, txt] of [[pc1Lab, res.theta1, "PC1"], [pc2Lab, res.theta1 + Math.PI / 2, "PC2"]] as const) {
      const dir: Pt = [Math.cos(t), Math.sin(t)];
      const d = reach(f, m, dir, 0, 0, W, PH, 30) * 0.92;
      const q = f.px([m[0] + d * dir[0], m[1] + d * dir[1]]);
      setAttrs(lab, { x: q[0] - 20 * Math.sin(t), y: q[1] - 20 * Math.cos(t) + 7 });
      lab.textContent = txt;
    }
    // score strips (same pixels-per-unit as the scatter, so lengths compare)
    for (const [row, t, top] of [[0, res.theta1, S1], [1, res.theta1 + Math.PI / 2, S2]] as const) {
      data.forEach((q, k) => {
        const s = score(q, m, t);
        const x = Math.max(8, Math.min(W - 8, W / 2 + s * f.ppu));
        const jit = ((k * 0.618034) % 1) * (SH - 36) + 30;
        setAttrs(stripEls[row][k], { cx: x, cy: top + jit });
      });
    }
    pct1.textContent = fmtPct(res.l1 / res.total);
    pct2.textContent = fmtPct(res.l2 / res.total);
    bar1.set(res.l1 / res.total);
    bar2.set(res.l2 / res.total);
    const u1: Pt = [Math.cos(res.theta1), Math.sin(res.theta1)];
    const nm = preset === "units" ? ["A", "B"] : ["gene1", "gene2"];
    const sgn = (v: number) => (v < 0 ? " − " : " + ");
    let txt = `PC1 direction: ${axisDeg(res.theta1).toFixed(1)}°\n`
      + `PC1 = ${u1[0].toFixed(2)}·${nm[0]}${sgn(u1[1])}${Math.abs(u1[1]).toFixed(2)}·${nm[1]}`;
    if (preset === "units") {
      const sd = standardise(raw).sd;
      txt += `\nSD(A) = ${fmtNum(sd[0])}, SD(B) = ${fmtNum(sd[1])}`;
    } else if (preset === "outlier") {
      const r0 = pca(cov(shown));
      txt += `\nwithout the outlier: ${axisDeg(r0.theta1).toFixed(1)}°, PC1 ${fmtPct(r0.l1 / r0.total)}`;
    }
    ro.textContent = txt;
  }

  load(preset);
}

autoMount(NAME, host => {
  injectStyle();
  if (host.dataset.mode === "pitfalls") mountPitfalls(host);
  else mountRotate(host);
});
