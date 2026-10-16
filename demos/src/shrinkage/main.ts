// Hierarchical shrinkage dumbbell. Auto-mounts on <div data-demo="shrinkage">.
// Each group is a row: raw group mean (open dot) -> partially pooled estimate (filled dot),
// grand mean as a dashed line, simulated truth as a faint tick. A slider sets tau^2
// (between-group variance) from 0 (complete pooling) to infinity (no pooling).
//
// data-* options (all optional):
//   data-n="1 2 2 3 5 8 12 20"  group sizes          data-mu="6"        true overall mean
//   data-sigma2="8"             within-group var      data-tau2="2"      true between-group var
//   data-prefix="P"             row label prefix      data-nunit="n="    size label, e.g. " cells"
//   data-xlabel="biomarker"     axis label            data-tauname="τ²"  name of tau^2 in the UI
//   data-seed="1"               first data set
import { svgEl, htmlEl, slider, button, presets, checkbox, scale, numList, autoMount } from "../lib/ui";
import { simulate, estimates, weight, sse, posToTau2, POS_MAX, Data } from "./model";

const STYLE = `
.qb-demo[data-demo="shrinkage"] .qb-plot { flex: 1 1 100%; max-width: 760px; }
.qb-demo[data-demo="shrinkage"] .qb-panel { flex: 0 1 380px; }
.reveal .qb-demo[data-demo="shrinkage"] .qb-plot { flex: 1 1 520px; max-width: 690px; }
.reveal .qb-demo[data-demo="shrinkage"] .qb-panel { flex: 0 1 370px; }
.qb-demo[data-demo="shrinkage"] .sh-row text { font-size: 20px; }
.qb-demo[data-demo="shrinkage"] .sh-line { display: flex; justify-content: space-between; gap: .6em; }
.qb-demo[data-demo="shrinkage"] .sh-btns { display: flex; gap: .35em; flex-wrap: wrap; }
.qb-demo[data-demo="shrinkage"] .sh-best { font-weight: 700; }
.reveal .qb-demo[data-demo="shrinkage"] .qb-plot { max-height: 530px; }
.reveal .qb-demo[data-demo="shrinkage"] .qb-readout { font-size: .8em; }
`;
let styled = false;

function fmtTau2(v: number): string {
  if (v === 0) return "0";
  if (!Number.isFinite(v)) return "∞";
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 0.1) return v.toFixed(2);
  return v.toPrecision(2);
}

function fmtErr(v: number): string { return v >= 10 ? v.toFixed(1) : v.toPrecision(2); }

function mount(host: HTMLElement): void {
  if (!styled) { const s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s); styled = true; }
  const ds = host.dataset;
  const n = numList(ds.n, [1, 2, 2, 3, 5, 8, 12, 20]);
  const mu = Number(ds.mu ?? 6), sigma2 = Number(ds.sigma2 ?? 8), tau2True = Number(ds.tau2 ?? 2);
  const prefix = ds.prefix ?? "P", nunit = ds.nunit ?? "n=", xlabel = ds.xlabel ?? "biomarker";
  const tauName = ds.tauname ?? "τ²";
  const seed0 = Number(ds.seed ?? 1);
  const G = n.length;
  const nmax = Math.max(...n);
  const nLabel = (k: number) => nunit.startsWith(" ") ? `${k}${nunit}` : `${nunit}${k}`;

  let seed = seed0;
  let pos = POS_MAX / 2;           // true tau2
  let showTruth = true;
  let data: Data = simulate(seed, n, mu, tau2True, sigma2);

  // ---------------- main dumbbell plot ----------------
  const W = 700, H = 476, L = 165, R = 590, T = 62, B = H - 58;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "shrinkage dumbbell plot" });
  host.appendChild(svg);
  const rowH = (B - T) / G;
  const ys = n.map((_, i) => T + rowH * (i + 0.5));

  // legend
  const leg = svgEl("g", { "font-size": 19 }, svg);
  svgEl("circle", { cx: 20, cy: 22, r: 7, fill: "#fff", stroke: "var(--qb-c1)", "stroke-width": 2.5 }, leg);
  svgEl("text", { x: 32, y: 28 }, leg).textContent = "raw mean";
  svgEl("circle", { cx: 150, cy: 22, r: 7, fill: "var(--qb-c1)" }, leg);
  svgEl("text", { x: 162, y: 28 }, leg).textContent = "partially pooled";
  const legTruth = svgEl("g", {}, leg);
  svgEl("line", { x1: 330, x2: 330, y1: 12, y2: 32, stroke: "var(--qb-c3)", "stroke-width": 3, opacity: 0.6 }, legTruth);
  svgEl("text", { x: 340, y: 28 }, legTruth).textContent = "truth";
  const gmLegend = svgEl("g", {}, leg);
  svgEl("line", { x1: 412, x2: 440, y1: 22, y2: 22, stroke: "var(--qb-axis)", "stroke-width": 2, "stroke-dasharray": "6 4" }, gmLegend);
  svgEl("text", { x: 446, y: 28 }, gmLegend).textContent = "grand mean";
  svgEl("text", { x: W - 8, y: 52, "text-anchor": "end", "font-size": 16, fill: "var(--qb-muted)" }, svg).textContent = "weight w";

  const axisG = svgEl("g", {}, svg);
  const gm = svgEl("line", { y1: T - 6, y2: B, stroke: "var(--qb-axis)", "stroke-width": 2, "stroke-dasharray": "7 5" }, svg);

  const rows = n.map((ni, i) => {
    const g = svgEl("g", { class: "sh-row" }, svg);
    const y = ys[i];
    svgEl("line", { x1: L, x2: R, y1: y, y2: y, class: "grid" }, g);
    const lab = svgEl("text", { x: 8, y: y + 6 }, g);
    lab.textContent = `${prefix}${String(i + 1).padStart(G >= 10 ? 2 : 1, "0")}  ${nLabel(ni)}`;
    const truth = svgEl("line", { y1: y - rowH * 0.38, y2: y + rowH * 0.38, stroke: "var(--qb-c3)", "stroke-width": 3, opacity: 0.55 }, g);
    const link = svgEl("line", { y1: y, y2: y, stroke: "var(--qb-c1)", "stroke-width": 3 }, g);
    const rad = Math.min(rowH * 0.42, 5 + 9 * Math.sqrt(ni / nmax));
    const rawDot = svgEl("circle", { cy: y, r: rad, fill: "#fff", stroke: "var(--qb-c1)", "stroke-width": 2.5 }, g);
    const estDot = svgEl("circle", { cy: y, r: rad, fill: "var(--qb-c1)", "fill-opacity": 0.9 }, g);
    const wTxt = svgEl("text", { x: W - 8, y: y + 6, "text-anchor": "end" }, g);
    return { truth, link, rawDot, estDot, wTxt };
  });

  let x = scale(0, 1, L, R);
  function setAxis(): void {
    const vals = [...data.raw, ...data.truth, data.grand];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = 0.06 * (hi - lo || 1);
    lo -= pad; hi += pad;
    x = scale(lo, hi, L, R);
    axisG.innerHTML = "";
    svgEl("line", { x1: L, x2: R, y1: B + 4, y2: B + 4, class: "axis" }, axisG);
    const span = hi - lo;
    const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 50].find(s => span / s <= 7) ?? 100;
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      svgEl("line", { x1: x(v), x2: x(v), y1: B + 4, y2: B + 10, class: "axis" }, axisG);
      svgEl("text", { x: x(v), y: B + 28, "text-anchor": "middle", "font-size": 18 }, axisG).textContent =
        String(Number(v.toFixed(2)));
    }
    svgEl("text", { x: (L + R) / 2, y: B + 52, "text-anchor": "middle", "font-size": 20 }, axisG).textContent = xlabel;
  }

  // ---------------- panel ----------------
  const panel = htmlEl("div", "qb-panel", "", host);
  const sl = slider(panel, tauName, 0, POS_MAX, 1, pos, v => { pos = v; markPresets(); draw(); },
    v => fmtTau2(posToTau2(v, tau2True)));
  const pre = presets(panel, [
    { label: `${tauName} = 0`, apply: () => setPos(0) },
    { label: `true ${tauName}`, apply: () => setPos(POS_MAX / 2) },
    { label: `${tauName} = ∞`, apply: () => setPos(POS_MAX) },
  ]);
  const presetPos = [0, POS_MAX / 2, POS_MAX];
  function markPresets(): void { pre.forEach((b, i) => b.classList.toggle("active", presetPos[i] === pos)); }
  function setPos(p: number): void { pos = p; sl.set(p); draw(); }
  const btns = htmlEl("div", "sh-btns", "", panel);
  const dataLab = htmlEl("span", "qb-note", "", btns);
  button(btns, "new data", () => { seed++; newData(); });
  button(btns, "reset", () => { seed = seed0; setPos(POS_MAX / 2); markPresets(); newData(); });
  checkbox(panel, "show truth", showTruth, v => { showTruth = v; draw(); });
  const readout = htmlEl("div", "qb-readout", "", panel);

  // error curve: total squared error vs slider position
  const CW = 280, CH = 170, cl = 46, cr = CW - 14, ct = 26, cb = CH - 34;
  const curve = svgEl("svg", { viewBox: `0 0 ${CW} ${CH}`, width: "100%" }, panel);
  svgEl("text", { x: cl, y: 18, "font-size": 16 }, curve).textContent = "total error² vs truth";
  const cAxis = svgEl("g", {}, curve);
  const cPath = svgEl("path", { fill: "none", stroke: "var(--qb-c2)", "stroke-width": 2.5 }, curve);
  const cDot = svgEl("circle", { r: 6, fill: "var(--qb-c2)" }, curve);
  const cx = scale(0, POS_MAX, cl, cr);
  let errs: number[] = [];
  let cy = scale(0, 1, cb, ct);

  function newData(): void {
    data = simulate(seed, n, mu, tau2True, sigma2);
    dataLab.textContent = `data set #${seed - seed0 + 1}`;
    errs = [];
    for (let p = 0; p <= POS_MAX; p++) errs.push(sse(estimates(data, sigma2, posToTau2(p, tau2True)), data.truth));
    const emax = Math.max(...errs);
    cy = scale(0, emax * 1.08, cb, ct);
    cAxis.innerHTML = "";
    svgEl("line", { x1: cl, x2: cr, y1: cb, y2: cb, class: "axis" }, cAxis);
    svgEl("line", { x1: cl, x2: cl, y1: ct, y2: cb, class: "axis" }, cAxis);
    svgEl("text", { x: cl - 6, y: cy(0) + 5, "text-anchor": "end", "font-size": 15 }, cAxis).textContent = "0";
    svgEl("text", { x: cl - 6, y: cy(emax) + 5, "text-anchor": "end", "font-size": 15 }, cAxis).textContent = fmtErr(emax);
    const ticks: [number, string][] = [[0, "0"], [POS_MAX / 2, `true`], [POS_MAX, "∞"]];
    for (const [p, s] of ticks)
      svgEl("text", { x: cx(p), y: cb + 22, "text-anchor": p === 0 ? "start" : p === POS_MAX ? "end" : "middle", "font-size": 15 }, cAxis)
        .textContent = s;
    svgEl("text", { x: (cl + cr) / 2 + 52, y: cb + 22, "text-anchor": "middle", "font-size": 15, fill: "var(--qb-muted)" }, cAxis)
      .textContent = tauName + " →";
    cPath.setAttribute("d", errs.map((e, p) => `${p ? "L" : "M"}${cx(p).toFixed(1)},${cy(e).toFixed(1)}`).join(""));
    setAxis();
    draw();
  }

  function draw(): void {
    const tau2 = posToTau2(pos, tau2True);
    const est = estimates(data, sigma2, tau2);
    gm.setAttribute("x1", String(x(data.grand)));
    gm.setAttribute("x2", String(x(data.grand)));
    rows.forEach((r, i) => {
      const xr = x(data.raw[i]), xe = x(est[i]), xt = x(data.truth[i]);
      r.rawDot.setAttribute("cx", String(xr));
      r.estDot.setAttribute("cx", String(xe));
      r.link.setAttribute("x1", String(xr));
      r.link.setAttribute("x2", String(xe));
      r.truth.setAttribute("x1", String(xt));
      r.truth.setAttribute("x2", String(xt));
      r.truth.style.display = showTruth ? "" : "none";
      r.wTxt.textContent = weight(n[i], sigma2, tau2).toFixed(2);
    });
    legTruthVisible();
    const eNo = sse(data.raw, data.truth);
    const eAll = sse(data.raw.map(() => data.grand), data.truth);
    const ePart = sse(est, data.truth);
    const best = Math.min(eNo, eAll, ePart);
    readout.innerHTML = "";
    const line = (lab: string, v: number) => {
      const d = htmlEl("div", "sh-line" + (v === best ? " sh-best" : ""), "", readout);
      htmlEl("span", "", lab, d);
      htmlEl("span", "", fmtErr(v), d);
    };
    htmlEl("div", "", "total error² vs truth", readout);
    line("no pooling", eNo);
    line("complete pooling", eAll);
    line(`partial (${tauName}=${fmtTau2(tau2)})`, ePart);
    readout.style.display = showTruth ? "" : "none";
    curve.style.display = showTruth ? "" : "none";
    cDot.setAttribute("cx", String(cx(pos)));
    cDot.setAttribute("cy", String(cy(errs[pos])));
  }
  function legTruthVisible(): void { legTruth.style.display = showTruth ? "" : "none"; }

  markPresets();
  newData();
}

autoMount("shrinkage", mount);
