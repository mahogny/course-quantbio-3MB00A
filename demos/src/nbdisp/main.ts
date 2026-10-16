// Negative binomial: generating counts, and how it generalises the Poisson.
// Auto-mounts on <div data-demo="nbdisp">.
// Primary view: histogram of N simulated counts (fixed seed, "draw again"), with the NB pmf
// overlaid as dots and the Poisson pmf with the same mean as a faint reference outline.
// Optional secondary view: log–log mean–variance plot (checkbox).
//
// data-* options (all optional):
//   data-param="phi"    Var = mu + phi mu^2  (phi = 0 is Poisson; error-models convention)
//   data-param="shape"  Var = mu + mu^2/phi  (phi = inf is Poisson; brms / bayes-case convention)
//   data-mu="50"  data-disp="0.5"  initial values (snapped to the slider's list)
//   data-n="1000"       number of simulated draws
//   data-unit="cells"   what one draw is
//   data-mv="on"        show the mean–variance plot from the start
//   data-seed="1"
import { svgEl, htmlEl, slider, button, presets, checkbox, scale, rng, autoMount } from "../lib/ui";
import { poisPmf, nbPmf, nbVar, quantile, rnb } from "./stats";

const STYLE = `
.qb-demo[data-demo="nbdisp"] .qb-plot { flex: 1 1 100%; max-width: 760px; }
.qb-demo[data-demo="nbdisp"] .qb-panel { flex: 0 1 380px; }
.reveal .qb-demo[data-demo="nbdisp"] .qb-plot { flex: 1 1 520px; max-width: 760px; }
.reveal .qb-demo[data-demo="nbdisp"] .qb-panel { flex: 0 1 360px; }
.qb-demo[data-demo="nbdisp"] .nb-btns { display: flex; gap: .35em; flex-wrap: wrap; align-items: center; }
.qb-demo[data-demo="nbdisp"] .nb-tab { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: .85em; width: 100%; margin: 0; }
.qb-demo[data-demo="nbdisp"] .nb-tab td, .qb-demo[data-demo="nbdisp"] .nb-tab th { padding: .05em .35em; text-align: right; border: none; white-space: nowrap; }
.qb-demo[data-demo="nbdisp"] .nb-tab td:first-child, .qb-demo[data-demo="nbdisp"] .nb-tab th:first-child { text-align: left; }
.qb-demo[data-demo="nbdisp"] .nb-mv { width: 100%; max-width: 330px; }
.reveal .qb-demo[data-demo="nbdisp"] .qb-plot { max-height: 540px; }
.reveal .qb-demo[data-demo="nbdisp"] { position: relative; }
.reveal .qb-demo[data-demo="nbdisp"] .nb-mv { position: absolute; right: 385px; top: 100px; width: 320px;
  background: var(--qb-bg); border: 1px solid var(--qb-grid); border-radius: 6px; padding: 4px; }
.reveal .qb-demo[data-demo="nbdisp"] .qb-panel { gap: .4em; }
.reveal .qb-demo[data-demo="nbdisp"] .nb-tab, .reveal .qb-demo[data-demo="nbdisp"] .nb-tab td, .reveal .qb-demo[data-demo="nbdisp"] .nb-tab th { font-size: 18px; }
.reveal .qb-demo[data-demo="nbdisp"] .qb-note { font-size: 18px; }
`;
let styled = false;

const MUS = [0.5, 1, 2, 3, 5, 8, 10, 15, 20, 24, 30, 50, 80, 100, 150, 200, 300, 500];
const PHIS = [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3];        // Var = mu + phi mu^2
const SHAPES = [0.2, 0.33, 0.5, 1, 2, 3, 5, 10, 20, 50, 100, Infinity];            // Var = mu + mu^2/phi

function nearest(list: number[], v: number): number {
  let best = 0;
  list.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(list[best] - v)) best = i; });
  return best;
}
function fmt(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  if (Number.isInteger(v) && Math.abs(v) < 1000) return String(v);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US").replace(/,/g, "\u2009");
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return Number(v.toPrecision(3)).toString();
}
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const pow10 = (e: number) => e === 0 ? "1" : e === 1 ? "10" : e === 2 ? "100" : "10" + String(e).split("").map(c => SUP[+c]).join("");

function mount(host: HTMLElement): void {
  if (!styled) { const s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s); styled = true; }
  const ds = host.dataset;
  const shape = ds.param === "shape";
  const DISP = shape ? SHAPES : PHIS;
  const POIS = shape ? Infinity : 0;            // dispersion value that gives the Poisson
  const unit = ds.unit ?? "cells";
  const N = Math.max(50, Math.round(Number(ds.n ?? 1000)));
  const seed0 = Number(ds.seed ?? 1);
  const mu0 = nearest(MUS, Number(ds.mu ?? 50));
  const d0 = nearest(DISP, Number(ds.disp ?? (shape ? 3 : 0.5)));
  let iMu = mu0, iD = d0, seed = seed0, showMV = ds.mv === "on";
  let draws: number[] = [];

  const mu = () => MUS[iMu];
  const disp = () => DISP[iD];
  /** NB size r (R's dnbinom size): Var = mu + mu^2 / r. */
  const size = () => shape ? disp() : (disp() === 0 ? Infinity : 1 / disp());
  const isPois = () => disp() === POIS;

  // ---------------- histogram ----------------
  const W = 720, H = 470, pL = 78, pR = W - 16, pT = 58, pB = H - 70;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "histogram of simulated counts with negative binomial and Poisson probabilities" });
  host.appendChild(svg);
  const leg = svgEl("g", { "font-size": 19 }, svg);
  svgEl("rect", { x: pL, y: 12, width: 18, height: 18, fill: "var(--qb-c4)", "fill-opacity": 0.45 }, leg);
  const legHist = svgEl("text", { x: pL + 24, y: 27 }, leg);
  svgEl("circle", { cx: pL + 262, cy: 21, r: 6, fill: "var(--qb-c2)" }, leg);
  svgEl("text", { x: pL + 274, y: 27 }, leg).textContent = "NB probability";
  svgEl("line", { x1: pL + 432, x2: pL + 460, y1: 21, y2: 21, stroke: "var(--qb-c1)", "stroke-width": 2.5, "stroke-dasharray": "5 3" }, leg);
  svgEl("text", { x: pL + 466, y: 27 }, leg).textContent = "Poisson, same μ";
  const axes = svgEl("g", {}, svg);
  const bars = svgEl("g", { fill: "var(--qb-c4)", "fill-opacity": 0.45 }, svg);
  const poisLine = svgEl("path", { fill: "none", stroke: "var(--qb-c1)", "stroke-width": 2.5, "stroke-dasharray": "5 3" }, svg);
  const nbLine = svgEl("path", { fill: "none", stroke: "var(--qb-c2)", "stroke-width": 1.5 }, svg);
  const nbDots = svgEl("g", { fill: "var(--qb-c2)" }, svg);
  const note = svgEl("text", { x: pR, y: pT + 4, "text-anchor": "end", "font-size": 17, fill: "var(--qb-muted)" }, svg);

  // ---------------- panel ----------------
  const panel = htmlEl("div", "qb-panel", "", host);
  const sMu = slider(panel, "mean μ", 0, MUS.length - 1, 1, iMu, v => { iMu = v; update(); }, v => fmt(MUS[v]));
  const sD = slider(panel, shape ? "shape φ" : "dispersion φ", 0, DISP.length - 1, 1, iD,
    v => { iD = v; update(); }, v => fmt(DISP[v]));
  const formula = htmlEl("div", "", "", panel);
  const formulaNum = htmlEl("div", "qb-note", "", panel);
  const setD = (v: number) => { iD = DISP.indexOf(v); sD.set(iD); };
  const setMu = (v: number) => { iMu = MUS.indexOf(v); sMu.set(iMu); };
  const mild = shape ? 10 : 0.1, strong = shape ? 0.5 : 2;
  const pre = presets(panel, [
    { label: "Poisson", apply: () => { setD(POIS); update(); } },
    { label: "mild overdispersion", apply: () => { setD(mild); update(); } },
    { label: "strong (many zeros)", apply: () => { setD(strong); update(); } },
    { label: "low mean", apply: () => { setMu(3); update(); } },
    { label: "high mean", apply: () => { setMu(100); update(); } },
  ]);
  function markPresets(): void {
    const on = [disp() === POIS, disp() === mild, disp() === strong, mu() === 3, mu() === 100];
    pre.forEach((b, i) => b.classList.toggle("active", on[i]));
  }
  const btns = htmlEl("div", "nb-btns", "", panel);
  button(btns, "draw again", () => { seed++; update(); });
  button(btns, "reset", () => { iMu = mu0; iD = d0; sMu.set(iMu); sD.set(iD); seed = seed0; update(); });
  const drawLab = htmlEl("span", "qb-note", "", btns);
  const tab = htmlEl("table", "nb-tab", "", panel);
  checkbox(panel, "mean–variance plot", showMV, v => { showMV = v; update(); });

  // ---------------- optional mean–variance plot ----------------
  const MW = 330, MH = 260, mL = 60, mR = MW - 12, mT = 14, mB = MH - 50, MV_MAX = 1000;
  const mv = svgEl("svg", { viewBox: `0 0 ${MW} ${MH}`, class: "nb-mv" }, panel);
  const mx = scale(Math.log10(0.5), Math.log10(MV_MAX), mL, mR);
  const my = scale(Math.log10(0.5), Math.log10(3e6), mB, mT);
  svgEl("rect", { x: mL, y: mT, width: mR - mL, height: mB - mT, fill: "none", class: "axis" }, mv);
  for (let e = 0; e <= 3; e++) {
    svgEl("line", { x1: mx(e), x2: mx(e), y1: mT, y2: mB, class: "grid" }, mv);
    svgEl("text", { x: mx(e), y: mB + 19, "text-anchor": "middle", "font-size": 16 }, mv).textContent = pow10(e);
  }
  for (let e = 0; e <= 6; e += 2) {
    svgEl("line", { x1: mL, x2: mR, y1: my(e), y2: my(e), class: "grid" }, mv);
    svgEl("text", { x: mL - 5, y: my(e) + 5, "text-anchor": "end", "font-size": 16 }, mv).textContent = pow10(e);
  }
  svgEl("text", { x: (mL + mR) / 2, y: mB + 42, "text-anchor": "middle", "font-size": 17 }, mv).textContent = "mean (log)";
  svgEl("text", { x: 14, y: (mT + mB) / 2, "text-anchor": "middle", "font-size": 17,
    transform: `rotate(-90 14 ${(mT + mB) / 2})` }, mv).textContent = "variance (log)";
  const clipId = `nbclip${Math.random().toString(36).slice(2, 8)}`;
  const clip = svgEl("clipPath", { id: clipId }, mv);
  svgEl("rect", { x: mL, y: mT, width: mR - mL, height: mB - mT }, clip);
  const mvG = svgEl("g", { "clip-path": `url(#${clipId})` }, mv);
  const mvP = svgEl("path", { fill: "none", stroke: "var(--qb-c1)", "stroke-width": 2.5, "stroke-dasharray": "5 3" }, mvG);
  const mvNB = svgEl("path", { fill: "none", stroke: "var(--qb-c2)", "stroke-width": 3 }, mvG);
  const mvDot = svgEl("circle", { r: 6, fill: "var(--qb-c2)" }, mvG);
  const mvS = svgEl("path", { stroke: "var(--qb-fg)", "stroke-width": 3, fill: "none" }, mvG);
  svgEl("text", { x: mR - 6, y: my(3) + 52, "text-anchor": "end", "font-size": 16, fill: "var(--qb-c1)" }, mv).textContent = "var = μ";

  function update(): void {
    const m = mu(), r = size(), v = nbVar(m, r);
    const g = rng(seed * 104729 + 7);
    draws = Array.from({ length: N }, () => rnb(m, r, g.unif));
    drawLab.textContent = `draw #${seed - seed0 + 1}`;
    legHist.textContent = `${N} simulated ${unit}`;

    // formula, in the unit's own convention
    const phi = fmt(disp());
    if (shape) {
      formula.textContent = "Var = μ + μ²/φ";
      formulaNum.textContent = isPois() ? `= ${fmt(m)} + 0 = ${fmt(m)}   (φ = ∞: Poisson)` : `= ${fmt(m)} + ${fmt(m)}²/${phi} = ${fmt(v)}`;
    } else {
      formula.textContent = "Var = μ + φμ²";
      formulaNum.textContent = isPois() ? `= ${fmt(m)} + 0 = ${fmt(m)}   (φ = 0: Poisson)` : `= ${fmt(m)} + ${phi}·${fmt(m)}² = ${fmt(v)}`;
    }

    // ---- histogram + pmfs ----
    const K = Math.max(quantile(k => nbPmf(k, m, r), 0.995, 20000), quantile(k => poisPmf(k, m), 0.999, 20000), 5);
    const bin = K + 1 <= 45 ? 1 : Math.ceil((K + 1) / 45);
    const nb = Math.ceil((K + 1) / bin);
    const binOf = (k: number) => Math.floor(k / bin);
    const kTop = nb * bin - 1;
    const hS = new Array(nb).fill(0), hN = new Array(nb).fill(0), hP = new Array(nb).fill(0);
    for (let k = 0; k <= kTop; k++) { const b = binOf(k); hN[b] += nbPmf(k, m, r); hP[b] += poisPmf(k, m); }
    let beyond = 0;
    for (const d of draws) { const b = binOf(d); if (b < nb) hS[b] += 1 / N; else beyond++; }
    const ymax = 1.08 * Math.max(...hS, ...hN, ...hP);
    const x = scale(0, nb, pL, pR), y = scale(0, ymax, pB, pT);
    const bw = (pR - pL) / nb, gap = bw > 8 ? bw * 0.08 : 0;
    bars.innerHTML = "";
    nbDots.innerHTML = "";
    let dN = "", dP = `M${x(0)},${pB}`;
    for (let b = 0; b < nb; b++) {
      svgEl("rect", { x: x(b) + gap, y: y(hS[b]), width: bw - 2 * gap, height: pB - y(hS[b]) }, bars);
      const cx = x(b + 0.5);
      dN += `${b ? "L" : "M"}${cx.toFixed(1)},${y(hN[b]).toFixed(1)}`;
      dP += `V${y(hP[b]).toFixed(1)}H${x(b + 1).toFixed(1)}`;
      svgEl("circle", { cx, cy: y(hN[b]), r: Math.min(6, Math.max(3, bw * 0.3)) }, nbDots);
    }
    dP += `V${pB}`;
    nbLine.setAttribute("d", dN);
    poisLine.setAttribute("d", dP);
    const zeros = draws.filter(d => d === 0).length;
    note.textContent = `zeros: ${zeros} of ${N} (Poisson ≈ ${fmt(Math.round(N * Math.exp(-m)))})` + (beyond ? ` · ${beyond} beyond ${kTop}` : "");

    axes.innerHTML = "";
    svgEl("line", { x1: pL, x2: pR, y1: pB, y2: pB, class: "axis" }, axes);
    svgEl("line", { x1: pL, x2: pL, y1: pT, y2: pB, class: "axis" }, axes);
    const kStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => kTop / s <= 8) ?? 10000;
    for (let k = 0; k <= kTop; k += kStep) {
      const xx = bin === 1 ? x(k + 0.5) : x(k / bin);
      if (xx > pR + 0.5) break;
      svgEl("line", { x1: xx, x2: xx, y1: pB, y2: pB + 6, class: "axis" }, axes);
      svgEl("text", { x: xx, y: pB + 26, "text-anchor": "middle", "font-size": 18 }, axes).textContent = String(k);
    }
    svgEl("text", { x: (pL + pR) / 2, y: pB + 56, "text-anchor": "middle", "font-size": 19 }, axes).textContent =
      bin === 1 ? `count per ${unit.replace(/s$/, "")}` : `count per ${unit.replace(/s$/, "")} (each bar = ${bin} values)`;
    const yStep = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5].find(s => ymax / s <= 6) ?? 1;
    for (let t = 0; t <= ymax + 1e-12; t += yStep) {
      svgEl("line", { x1: pL - 6, x2: pL, y1: y(t), y2: y(t), class: "axis" }, axes);
      svgEl("text", { x: pL - 9, y: y(t) + 6, "text-anchor": "end", "font-size": 17 }, axes).textContent = String(Number(t.toFixed(3)));
    }
    svgEl("text", { x: 18, y: (pT + pB) / 2, "text-anchor": "middle", "font-size": 19,
      transform: `rotate(-90 18 ${(pT + pB) / 2})` }, axes).textContent = `fraction of ${unit}`;

    // ---- readouts ----
    const sm = draws.reduce((a, b) => a + b, 0) / N;
    const sv = draws.reduce((a, b) => a + (b - sm) ** 2, 0) / (N - 1);
    tab.innerHTML = "";
    const row = (cells: string[], th = false) => {
      const tr = htmlEl("tr", "", "", tab);
      cells.forEach(c => htmlEl(th ? "th" : "td", "", c, tr));
      return tr;
    };
    row(["", "mean", "var", "var/mean"], true);
    row(["theory", fmt(m), fmt(v), fmt(v / m)]).style.color = "var(--qb-c2)";
    row(["sample", fmt(sm), fmt(sv), sm > 0 ? fmt(sv / sm) : "–"]);

    // ---- mean–variance plot ----
    mv.style.display = showMV ? "" : "none";
    if (showMV) {
      const pP: string[] = [], pN: string[] = [];
      for (let i = 0; i <= 60; i++) {
        const lm = Math.log10(0.5) + i * (Math.log10(MV_MAX) - Math.log10(0.5)) / 60;
        pP.push(`${i ? "L" : "M"}${mx(lm).toFixed(1)},${my(lm).toFixed(1)}`);
        pN.push(`${i ? "L" : "M"}${mx(lm).toFixed(1)},${my(Math.log10(nbVar(Math.pow(10, lm), r))).toFixed(1)}`);
      }
      mvP.setAttribute("d", pP.join(""));
      mvNB.setAttribute("d", pN.join(""));
      mvDot.setAttribute("cx", String(mx(Math.log10(m))));
      mvDot.setAttribute("cy", String(my(Math.log10(v))));
      if (sm > 0 && sv > 0) {
        const X = mx(Math.log10(sm)), Y = my(Math.log10(sv));
        mvS.setAttribute("d", `M${X - 6},${Y - 6}L${X + 6},${Y + 6}M${X - 6},${Y + 6}L${X + 6},${Y - 6}`);
      } else mvS.setAttribute("d", "");
    }
    markPresets();
  }

  update();
}

autoMount("nbdisp", mount);
