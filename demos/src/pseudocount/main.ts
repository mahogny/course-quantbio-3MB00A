// Pseudocount explorer: the shifted log log(x + c) on simulated UMI counts.
// (a) the transform curve over 0..20 with markers at 0 and 1 UMI (with normalization:
//     1 UMI in a deep, a median and a shallow cell), (b) strip plots of the transformed
//     values of a low and a high gene, (c) variance after the log against the gene mean,
//     with the 10 most variable genes marked. Controls: c, log base, normalization
//     x / n * 10,000 (Seurat's NormalizeData) before the log.
// Auto-mounts on <div data-demo="pseudocount">. Optional: data-c="1", data-base="e|2",
// data-normalize="1|0".
import { svgEl, htmlEl, slider, presets, checkbox, scale, rng, autoMount } from "../lib/ui";
import { simulate, values, tlog, meanVar, topK, variance, mean, SCALE } from "./sim";

const NAME = "pseudocount";
const COL = { lo: "#d95f02", hi: "#1f77b4", mk: "#2ca02c", big: "#9467bd", bg: "#9a9a9a", ref: "#999" };
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .5em; }
[data-demo="${NAME}"] .pc-controls { display: flex; flex-wrap: wrap; gap: .4em 1.4em; align-items: center; }
[data-demo="${NAME}"] .pc-controls .qb-slider { min-width: 340px; }
[data-demo="${NAME}"] .pc-group { display: flex; gap: .4em; align-items: center; }
[data-demo="${NAME}"] .pc-plots { display: flex; flex-wrap: wrap; gap: 12px; width: 100%; }
[data-demo="${NAME}"] .pc-plots svg { min-width: 0; height: auto; }
[data-demo="${NAME}"] svg text { font-size: 17px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 15px; fill: #555; }
.reveal [data-demo="${NAME}"] { font-size: 20px; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const fmtC = (c: number): string => (c >= 10 ? c.toFixed(0) : c >= 1 ? c.toFixed(1) : c >= 0.1 ? c.toFixed(2) : c.toFixed(3));
const f2 = (v: number): string => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

function mount(host: HTMLElement): void {
  injectStyle();
  const data = simulate(7);
  const st = {
    lc: Math.log10(Number(host.dataset.c ?? 1)),
    base: host.dataset.base === "2" ? 2 : Math.E,
    norm: host.dataset.normalize !== "0",
  };
  const iLow = data.genes.findIndex(g => g.kind === "bg" && g.mean > 0.3);
  const iHigh = data.genes.findIndex(g => g.kind === "bg" && g.mean >= 30 - 1e-9);
  const sortedDepth = [...data.depth].sort((a, b) => a - b);
  const nMin = sortedDepth[0], nMax = sortedDepth[sortedDepth.length - 1];
  const nMed = sortedDepth[sortedDepth.length >> 1];

  // ---- controls ----
  const ctr = htmlEl("div", "pc-controls", "", host);
  const cS = slider(ctr, "pseudocount c", -2, 2, 0.05, st.lc, v => { st.lc = v; cBtns.forEach(b => b.classList.remove("active")); draw(); },
    v => fmtC(10 ** v));
  const cg = htmlEl("div", "pc-group", "", ctr);
  htmlEl("span", "", "c =", cg);
  const cVals = [0.01, 0.1, 1, 10, 100];
  const cBtns = presets(cg, cVals.map(c => ({ label: String(c), apply: () => { st.lc = Math.log10(c); cS.set(st.lc); draw(); } })));
  const bg = htmlEl("div", "pc-group", "", ctr);
  htmlEl("span", "", "base:", bg);
  const bBtns = presets(bg, [
    { label: "e (log1p)", apply: () => { st.base = Math.E; draw(); } },
    { label: "2", apply: () => { st.base = 2; draw(); } },
  ]);
  bBtns[st.base === 2 ? 1 : 0].classList.add("active");
  checkbox(ctr, "normalize first: x / n · 10,000", st.norm, on => { st.norm = on; draw(); });

  const ro = htmlEl("div", "qb-readout", "", host);
  const plots = htmlEl("div", "pc-plots", "", host);
  const H = 400, WA = 380, WB = 300, WC = 440, WT = WA + WB + WC;

  // ---- (a) transform curve ----
  const svgA = svgEl("svg", { viewBox: `0 0 ${WA} ${H}`, role: "img", "aria-label": "The curve log(x + c)" }, plots);
  svgA.style.width = `calc(${(100 * WA / WT).toFixed(2)}% - 10px)`;
  const XMAX = 10;
  const ax = scale(0, XMAX, 62, WA - 14);
  // ---- (b) strips ----
  const svgB = svgEl("svg", { viewBox: `0 0 ${WB} ${H}`, role: "img", "aria-label": "Transformed values of a low and a high gene" }, plots);
  svgB.style.width = `calc(${(100 * WB / WT).toFixed(2)}% - 10px)`;
  // ---- (c) mean-variance ----
  const svgC = svgEl("svg", { viewBox: `0 0 ${WC} ${H}`, role: "img", "aria-label": "Variance after the log against the gene mean" }, plots);
  svgC.style.width = `calc(${(100 * WC / WT).toFixed(2)}% - 10px)`;
  const cx = scale(Math.log10(0.005), Math.log10(2000), 62, WC - 12);

  const jit = rng(11);
  const jitter = data.depth.map(() => jit.unif() - 0.5);
  const top = 46, bottom = H - 62;

  function yRange(): [number, number] { return [tlog(0, 0.008, st.base), tlog(400, 0, st.base)]; }

  function axisY(svg: SVGSVGElement, sy: (v: number) => number, x0: number, x1: number, lo: number, hi: number, label: string): void {
    const step = st.base === 2 ? 2 : 1;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      svgEl("line", { x1: x0, x2: x1, y1: sy(v), y2: sy(v), class: v === 0 ? "axis" : "grid", "stroke-width": v === 0 ? 1.5 : 1 }, svg);
      svgEl("text", { x: x0 - 6, y: sy(v) + 6, "text-anchor": "end", class: "sm" }, svg).textContent = String(v);
    }
    const t = svgEl("text", { x: 16, y: (top + bottom) / 2, "text-anchor": "middle", transform: `rotate(-90 16 ${(top + bottom) / 2})` }, svg);
    t.textContent = label;
  }

  function draw(): void {
    const c = 10 ** st.lc, b = st.base;
    const L = (v: number) => tlog(v, c, b);
    const logName = b === 2 ? "log₂" : "log";
    cBtns.forEach((btn, i) => btn.classList.toggle("active", Math.abs(Math.log10(cVals[i]) - st.lc) < 1e-6));
    const vals = values(data, st.norm);
    const [lo, hi] = yRange();
    const sy = scale(lo, hi, bottom, top);

    // (a)
    svgA.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgA).textContent = `(a) the transform ${logName}(x + c)`;
    axisY(svgA, sy, 62, WA - 14, lo, hi, `${logName}(x + c)`);
    for (let x = 0; x <= XMAX; x += 2) {
      svgEl("line", { x1: ax(x), x2: ax(x), y1: bottom, y2: bottom + 5, class: "axis" }, svgA);
      svgEl("text", { x: ax(x), y: bottom + 22, "text-anchor": "middle", class: "sm" }, svgA).textContent = String(x);
    }
    svgEl("text", { x: (62 + WA) / 2, y: H - 14, "text-anchor": "middle" }, svgA).textContent =
      st.norm ? "x / n · 10,000 (normalized)" : "x (raw UMI count)";
    const curve = (cc: number) => Array.from({ length: 201 }, (_, i) => i * XMAX / 200).map(x => `${ax(x)},${sy(tlog(x, cc, b))}`).join(" ");
    if (Math.abs(c - 1) > 1e-6) {
      svgEl("polyline", { points: curve(1), fill: "none", stroke: COL.ref, "stroke-width": 2, "stroke-dasharray": "6 5" }, svgA);
      svgEl("text", { x: ax(XMAX) - 4, y: sy(tlog(XMAX, 1, b)) + (c > 1 ? 22 : -10), "text-anchor": "end", class: "sm" }, svgA).textContent = "c = 1";
    }
    svgEl("polyline", { points: curve(c), fill: "none", stroke: "#222", "stroke-width": 3 }, svgA);
    // markers: 0 and one UMI
    const ones: [number, string][] = st.norm
      ? [[SCALE / nMax, `deep cell (n = ${nMax})`], [SCALE / nMed, `median (n = ${nMed})`], [SCALE / nMin, `shallow (n = ${nMin})`]]
      : [[1, "1 UMI"]];
    const dot = (x: number, fill: string) => svgEl("circle", { cx: ax(x), cy: sy(L(x)), r: 7, fill, stroke: "#fff", "stroke-width": 1.5 }, svgA);
    dot(0, COL.lo);
    ones.forEach(([x]) => dot(x, COL.hi));
    const xm = st.norm ? SCALE / nMed : 1;
    svgEl("line", { x1: ax(xm) + 12, x2: ax(xm) + 12, y1: sy(L(0)), y2: sy(L(xm)), stroke: COL.hi, "stroke-width": 2.5 }, svgA);
    // legend in the empty lower right corner of the plot
    const leg = (txt: string, y: number, fill: string) => {
      const t = svgEl("text", { x: ax(XMAX) - 4, y, "text-anchor": "end", "font-weight": 600 }, svgA);
      t.style.fill = fill; t.textContent = txt;
    };
    leg("● 0 UMI", sy(lo) - 34, COL.lo);
    leg(st.norm ? "● 1 UMI (3 cells)" : "● 1 UMI", sy(lo) - 10, COL.hi);
    const step = (x: number) => f2(L(x) - L(0));
    let txt = `step 0 → 1 UMI: +${step(xm)}` + (st.norm
      ? ` in the median cell (n = ${nMed}); deepest cell +${step(SCALE / nMax)}, shallowest +${step(SCALE / nMin)}` +
        `\npseudocount in raw counts, c·n / 10,000: ${fmtC(c * nMin / SCALE)} to ${fmtC(c * nMax / SCALE)}`
      : "");

    // (b)
    svgB.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgB).textContent = "(b) two genes, all cells";
    axisY(svgB, sy, 54, WB - 8, lo, hi, `${logName}(x + c)`);
    const cols: [number, string, number][] = [[iLow, COL.lo, 54 + (WB - 62) * 0.27], [iHigh, COL.hi, 54 + (WB - 62) * 0.75]];
    for (const [g, col, x0] of cols) {
      const tv = vals[g].map(L);
      tv.forEach((v, i) => svgEl("circle", { cx: x0 + jitter[i] * 70, cy: sy(v), r: 3.2, fill: col, "fill-opacity": 0.45 }, svgB));
      const raw = data.counts[g];
      const zeros = raw.filter(x => x === 0).length / raw.length;
      const mt = svgEl("text", { x: x0, y: bottom + 20, "text-anchor": "middle", "font-weight": 600 }, svgB);
      mt.style.fill = col; mt.textContent = `mean ${f2(mean(raw))}`;
      svgEl("text", { x: x0, y: bottom + 38, "text-anchor": "middle", class: "sm" }, svgB).textContent = `${Math.round(100 * zeros)}% zeros`;
      svgEl("text", { x: x0, y: bottom + 57, "text-anchor": "middle" }, svgB).textContent = `var ${f2(variance(tv))}`;
    }

    // (c)
    svgC.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgC).textContent = "(c) variance after the log, per gene";
    const mv = meanVar(vals, c, b);
    const vmax = Math.max(...mv.map(p => p.v)) * 1.08;
    const sv = scale(0, vmax, bottom, top + 18);
    const tick = niceStep(vmax / 4);
    for (let v = 0; v <= vmax; v += tick) {
      svgEl("line", { x1: 62, x2: WC - 12, y1: sv(v), y2: sv(v), class: v === 0 ? "axis" : "grid" }, svgC);
      svgEl("text", { x: 56, y: sv(v) + 6, "text-anchor": "end", class: "sm" }, svgC).textContent = String(+v.toFixed(3));
    }
    const yl = svgEl("text", { x: 16, y: (top + bottom) / 2, "text-anchor": "middle", transform: `rotate(-90 16 ${(top + bottom) / 2})` }, svgC);
    yl.textContent = "variance";
    for (const m of [0.01, 0.1, 1, 10, 100, 1000]) {
      svgEl("line", { x1: cx(Math.log10(m)), x2: cx(Math.log10(m)), y1: bottom, y2: bottom + 5, class: "axis" }, svgC);
      svgEl("text", { x: cx(Math.log10(m)), y: bottom + 22, "text-anchor": "middle", class: "sm" }, svgC).textContent = String(m);
    }
    svgEl("text", { x: (62 + WC) / 2, y: H - 14, "text-anchor": "middle" }, svgC).textContent =
      st.norm ? "gene mean (normalized, log axis)" : "gene mean (UMIs, log axis)";
    const t10 = topK(mv.map(p => p.v), 10);
    const thr = mv[t10[9]].v;
    svgEl("line", { x1: 62, x2: WC - 12, y1: sv(thr), y2: sv(thr), stroke: "#444", "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svgC);
    const nmk = t10.filter(i => data.genes[i].kind === "mk").length;
    svgEl("text", { x: WC - 14, y: sv(thr) - 7, "text-anchor": "end", class: "sm" }, svgC).textContent = "top 10";
    const kinds = t10.map(i => data.genes[i].kind);
    const nhi = kinds.filter(k => k === "hi").length, nbg = kinds.filter(k => k === "bg").length;
    txt += `\n10 most variable genes: ${nmk} markers, ${nbg} background, ${nhi} very high`;
    ro.textContent = txt;
    const order = mv.map((_, i) => i).sort((i, j) => rank(i) - rank(j));
    function rank(i: number): number { return data.genes[i].kind === "bg" ? 0 : 1; }
    for (const i of order) {
      const g = data.genes[i];
      const fill = g.kind === "mk" ? COL.mk : g.kind === "hi" ? COL.big : COL.bg;
      svgEl("circle", { cx: cx(Math.log10(Math.max(mv[i].m, 0.005))), cy: sv(mv[i].v), r: g.kind === "bg" ? 4.5 : 6, fill, "fill-opacity": 0.85 }, svgC);
      if (i === iLow || i === iHigh)
        svgEl("circle", { cx: cx(Math.log10(Math.max(mv[i].m, 0.005))), cy: sv(mv[i].v), r: 10, fill: "none",
          stroke: i === iLow ? COL.lo : COL.hi, "stroke-width": 3 }, svgC);
    }
    // legend
    const lg: [string, string][] = [["background", COL.bg], ["very high", COL.big], ["markers", COL.mk]];
    lg.forEach(([name, col], k) => {
      const x0 = [70, 190, 290][k];
      svgEl("circle", { cx: x0, cy: top + 2, r: 6, fill: col }, svgC);
      svgEl("text", { x: x0 + 11, y: top + 8, class: "sm" }, svgC).textContent = name;
    });
  }

  draw();
}

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

autoMount(NAME, mount);
