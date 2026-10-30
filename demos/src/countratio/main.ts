// Count ratios: the ratio x / y of two counts is very noisy when the counts are small,
// even when nothing differs between the samples. Sequencing = drawing reads at random.
// (a) one gene with expected count n in both samples, many replicate pairs: histogram of
//     log2(x / y), with pairs that contain a zero in separate "0", "∞" and "0/0" bars
//     (no pseudocount). Red = the pair looks at least 2-fold different.
// (b) the fan: log2(x / y) against the average count (x + y) / 2 for many genes whose
//     expected counts are spread log-uniformly from 0.5 to 5000, the same in both samples;
//     genes with one zero sit on the "∞" / "0" rows, 0/0 genes are left out. The band marks
//     the n of panel (a); red circles are the 10 largest |log2 ratio| among genes with no zero.
// Controls: n presets, "add biological variation" (gamma-mixed, off by default), draw again.
//
// Auto-mounts on <div data-demo="countratio">. data-* options (all optional):
//   data-mean="2"     initial expected count n (snapped to the preset list)
//   data-bio="on"     start with biological variation switched on
//   data-pairs="2000" replicate pairs in (a)      data-genes="2000"  genes in (b)
//   data-seed="1"
import { svgEl, htmlEl, button, presets, checkbox, scale, autoMount } from "../lib/ui";
import { pairs, genes, summarize, topFinite, log2ratio, Genes } from "./sim";

const NAME = "countratio";
const NS = [1, 2, 5, 10, 30, 100, 300, 1000];
const COL = { same: "var(--qb-c1)", big: "var(--qb-c2)", none: "#9a9a9a", dot: "#8a8a8a", band: "var(--qb-accent)" };
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .45em; }
[data-demo="${NAME}"] .cr-controls { display: flex; flex-wrap: wrap; gap: .35em 1.2em; align-items: center; }
[data-demo="${NAME}"] .cr-group { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="${NAME}"] .cr-plots { display: flex; flex-wrap: wrap; gap: 12px; width: 100%; }
[data-demo="${NAME}"] .cr-plots svg { flex: 1 1 380px; min-width: 0; max-width: calc(50% - 6px); height: auto; }
[data-demo="${NAME}"] svg text { font-size: 17px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 15.5px; fill: #555; }
[data-demo="${NAME}"] .qb-note { margin: 0; }
.reveal [data-demo="${NAME}"] { font-size: 20px; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 17px; }
.reveal [data-demo="${NAME}"] p.qb-note { margin: 0 0 .2em; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1.1em; height: 1.1em; }
@media (max-width: 760px) { [data-demo="${NAME}"] .cr-plots svg { max-width: 100%; flex-basis: 100%; } }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const pct = (f: number): string => `${Math.round(100 * f)}%`;
const f1 = (v: number): string => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, ""));
const fmtN = (v: number): string => (v >= 1000 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : String(+v.toPrecision(3)));

function nearest(v: number): number {
  let b = 0;
  NS.forEach((x, i) => { if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(NS[b] / v))) b = i; });
  return b;
}

/** Text with coloured parts: [text, colour or ""][] */
function rich(svg: SVGSVGElement, x: number, y: number, parts: [string, string][], cls = "sm"): void {
  const t = svgEl("text", { x, y, class: cls }, svg);
  for (const [s, c] of parts) {
    const sp = svgEl("tspan", {}, t);
    sp.textContent = s;
    if (c) { sp.style.fill = c; sp.style.fontWeight = "600"; }
  }
}

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const N = Math.max(100, Math.round(Number(ds.pairs ?? 2000)) || 2000);
  const G = Math.max(100, Math.round(Number(ds.genes ?? 2000)) || 2000);
  const seed0 = Number(ds.seed ?? 1) || 1;
  const st = { i: nearest(Number(ds.mean ?? 2) || 2), bio: ds.bio === "on" || ds.bio === "1", seed: seed0 };
  let fan: Genes = genes(G, st.bio, st.seed);

  // ---- controls ----
  const ctr = htmlEl("div", "cr-controls", "", host);
  const g1 = htmlEl("div", "cr-group", "", ctr);
  htmlEl("span", "", "expected count n:", g1);
  const nBtns = presets(g1, NS.map((n, i) => ({ label: String(n), apply: () => { st.i = i; drawA(); drawB(); } })));
  nBtns[st.i].classList.add("active");
  const g2 = htmlEl("div", "cr-group", "", ctr);
  checkbox(g2, "add biological variation", st.bio, on => { st.bio = on; fan = genes(G, st.bio, st.seed); drawA(); drawB(); });
  htmlEl("span", "qb-note", "(replicates differ more than counting alone; week 4)", g2);
  button(ctr, "draw again", () => { st.seed++; fan = genes(G, st.bio, st.seed); drawA(); drawB(); });
  htmlEl("p", "qb-note",
    "Sequencing = drawing reads at random. Both samples have the same expected count for every gene, so every difference below is chance.", host);

  const plots = htmlEl("div", "cr-plots", "", host);
  const W = 560, H = 440, pT = 92, pB = H - 58;
  const svgA = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Histogram of log2 ratios of replicate pairs" }, plots);
  const svgB = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "log2 ratio against average count for many genes" }, plots);

  // ---------------- (a) replicate pairs ----------------
  const LIM = 4, BW = 0.25;
  const aL = 50, z0 = [aL + 6, aL + 40], hx = scale(-LIM - BW / 2, LIM + BW / 2, aL + 54, W - 116);
  const zInf = [W - 106, W - 72], zNaN = [W - 50, W - 16];

  function drawA(): void {
    const n = NS[st.i];
    const { x, y } = pairs(n, st.bio, N, st.seed);
    const s = summarize(x, y, n);
    const nb = Math.round(2 * LIM / BW) + 1;
    const small = new Array(nb).fill(0), big = new Array(nb).fill(0);
    for (const l of s.finite) {
      const b = Math.min(nb - 1, Math.max(0, Math.round((l + LIM) / BW)));
      (Math.abs(l) >= 1 ? big : small)[b]++;
    }
    const tot = s.N;
    const ymax = Math.max(...small.map((v, i) => v + big[i]), s.zeroX, s.zeroY, s.both) / tot * 100;
    const step = niceStep(ymax / 4);
    const top = Math.max(step, Math.ceil(ymax / step) * step);
    const sy = scale(0, top, pB, pT);

    svgA.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgA).textContent = `(a) one gene, n = ${fmtN(n)}: ${fmtN(N)} replicate pairs`;
    rich(svgA, 8, 50, [[`x, y vary by about ±${f1(s.sdCount)} around ${fmtN(n)}`, ""],
      [st.bio ? `  (counting alone ±${f1(Math.sqrt(n))})` : `  (√n = ${f1(Math.sqrt(n))})`, ""]]);
    rich(svgA, 8, 72, [[`look ≥ 2-fold different: ${pct(s.twofold)}`, COL.big],
      [`  ·  SD of log2 ratio (no 0) ${Number.isFinite(s.sd) ? s.sd.toFixed(2) : "–"}`, ""]]);

    for (let v = 0; v <= top + 1e-9; v += step) {
      svgEl("line", { x1: aL, x2: W - 10, y1: sy(v), y2: sy(v), class: v === 0 ? "axis" : "grid" }, svgA);
      svgEl("text", { x: aL - 6, y: sy(v) + 5, "text-anchor": "end", class: "sm" }, svgA).textContent = `${+v.toFixed(1)}%`;
    }
    // 2-fold lines
    for (const v of [-1, 1]) svgEl("line", { x1: hx(v), x2: hx(v), y1: pT - 4, y2: pB, stroke: "#555", "stroke-width": 1.3, "stroke-dasharray": "5 4" }, svgA);
    svgEl("text", { x: hx(1) + 4, y: pT + 10, class: "sm" }, svgA).textContent = "2×";
    svgEl("text", { x: hx(-1) - 4, y: pT + 10, class: "sm", "text-anchor": "end" }, svgA).textContent = "½×";
    // finite bars, stacked: |log2 ratio| < 1 below, >= 1 on top
    const bw = hx(BW) - hx(0);
    for (let b = 0; b < nb; b++) {
      const c = -LIM + b * BW, x0 = hx(c) - bw / 2 + 0.5;
      const h1 = small[b] / tot * 100, h2 = big[b] / tot * 100;
      if (h1 > 0) svgEl("rect", { x: x0, width: bw - 1, y: sy(h1), height: pB - sy(h1), fill: COL.same, "fill-opacity": 0.75 }, svgA);
      if (h2 > 0) svgEl("rect", { x: x0, width: bw - 1, y: sy(h1 + h2), height: sy(h1) - sy(h1 + h2), fill: COL.big, "fill-opacity": 0.75 }, svgA);
    }
    // special bars
    const special: [number[], number, string, string][] = [[z0, s.zeroX, "0", COL.big], [zInf, s.zeroY, "∞", COL.big], [zNaN, s.both, "0/0", COL.none]];
    for (const [[a, b], cnt, lab, col] of special) {
      const h = cnt / tot * 100;
      if (h > 0) svgEl("rect", { x: a, width: b - a, y: sy(h), height: pB - sy(h), fill: col, "fill-opacity": 0.75 }, svgA);
      svgEl("text", { x: (a + b) / 2, y: pB + 21, "text-anchor": "middle", "font-weight": 600 }, svgA).textContent = lab;
    }
    for (const v of [-4, -2, 0, 2, 4])
      svgEl("text", { x: hx(v), y: pB + 21, "text-anchor": "middle", class: "sm" }, svgA).textContent = v < 0 ? `−${-v}` : String(v);
    svgEl("text", { x: hx(0), y: H - 10, "text-anchor": "middle" }, svgA).textContent = "log2(x / y)";
    svgEl("text", { x: W - 12, y: H - 10, "text-anchor": "end", class: "sm" }, svgA).textContent = "pairs with a 0";
  }

  // ---------------- (b) the fan ----------------
  const bL = 62, bR = W - 14, ROW = 5.9, YL = 5;
  const fx = scale(Math.log10(0.35), Math.log10(7000), bL, bR);
  const fy = scale(-ROW, ROW, pB - 6, pT + 6);

  function drawB(): void {
    const n = NS[st.i];
    const { x, y } = fan;
    svgB.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgB).textContent = `(b) ${fmtN(G)} genes, nothing differs`;
    // band for the n of panel (a)
    const b0 = fx(Math.log10(n / Math.SQRT2)), b1 = fx(Math.log10(n * Math.SQRT2));
    svgEl("rect", { x: b0, width: b1 - b0, y: pT, height: pB - pT, fill: COL.band, "fill-opacity": 0.13 }, svgB);
    const bl = svgEl("text", { x: (b0 + b1) / 2, y: pT - 5, "text-anchor": "middle", "font-weight": 600 }, svgB);
    bl.style.fill = "var(--qb-accent)"; bl.textContent = `n = ${fmtN(n)}`;
    // grid
    for (const v of [-4, -2, 0, 2, 4]) {
      svgEl("line", { x1: bL, x2: bR, y1: fy(v), y2: fy(v), class: v === 0 ? "axis" : "grid" }, svgB);
      svgEl("text", { x: bL - 6, y: fy(v) + 5, "text-anchor": "end", class: "sm" }, svgB).textContent = v < 0 ? `−${-v}` : String(v);
    }
    for (const v of [-1, 1]) svgEl("line", { x1: bL, x2: bR, y1: fy(v), y2: fy(v), stroke: "#555", "stroke-width": 1.3, "stroke-dasharray": "5 4" }, svgB);
    for (const [v, lab] of [[ROW, "∞"], [-ROW, "0"]] as [number, string][]) {
      svgEl("line", { x1: bL, x2: bR, y1: fy(v), y2: fy(v), class: "grid", "stroke-dasharray": "2 3" }, svgB);
      svgEl("text", { x: bL - 6, y: fy(v) + 6, "text-anchor": "end", "font-weight": 600 }, svgB).textContent = lab;
    }
    for (const m of [1, 10, 100, 1000]) {
      svgEl("line", { x1: fx(Math.log10(m)), x2: fx(Math.log10(m)), y1: pB, y2: pB + 5, class: "axis" }, svgB);
      svgEl("text", { x: fx(Math.log10(m)), y: pB + 21, "text-anchor": "middle", class: "sm" }, svgB).textContent = fmtN(m);
    }
    svgEl("line", { x1: bL, x2: bR, y1: pB, y2: pB, class: "axis" }, svgB);
    svgEl("text", { x: (bL + bR) / 2, y: H - 10, "text-anchor": "middle" }, svgB).textContent = "average count (x + y) / 2, log axis";
    const yt = svgEl("text", { x: 16, y: (pT + pB) / 2, "text-anchor": "middle", transform: `rotate(-90 16 ${(pT + pB) / 2})` }, svgB);
    yt.textContent = "log2(x / y)";

    // points
    let lowN = 0, lowBig = 0, hiN = 0, hiBig = 0, nn = 0;
    const pts = svgEl("g", { fill: COL.dot, "fill-opacity": 0.4 }, svgB);
    const pos = (i: number): [number, number] | null => {
      const l = log2ratio(x[i], y[i]);
      if (Number.isNaN(l)) return null;
      const yy = l === Infinity ? ROW : l === -Infinity ? -ROW : Math.max(-YL - 0.4, Math.min(YL + 0.4, l));
      return [fx(Math.log10((x[i] + y[i]) / 2)), fy(yy)];
    };
    for (let i = 0; i < x.length; i++) {
      const p = pos(i);
      if (!p) { nn++; continue; }
      svgEl("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 2.6 }, pts);
      const a = (x[i] + y[i]) / 2, big = Math.abs(log2ratio(x[i], y[i])) >= 1 ? 1 : 0;
      if (a < 10) { lowN++; lowBig += big; } else if (a > 100) { hiN++; hiBig += big; }
    }
    const t10 = topFinite(x, y, 10);
    const avg = t10.map(i => (x[i] + y[i]) / 2);
    for (const i of t10) {
      const p = pos(i)!;
      svgEl("circle", { cx: p[0], cy: p[1], r: 6.5, fill: "none", stroke: COL.big, "stroke-width": 2.5 }, svgB);
    }
    rich(svgB, 8, 50, [["≥ 2-fold: ", ""], [`${pct(lowN ? lowBig / lowN : 0)} of genes with average < 10`, COL.big],
      [`, ${pct(hiN ? hiBig / hiN : 0)} above 100`, ""]]);
    rich(svgB, 8, 72, [["○ top 10 |log2 ratio| without a 0", COL.big],
      [`: averages ${f1(Math.min(...avg))}–${f1(Math.max(...avg))}`, ""]]);
    if (nn) svgEl("text", { x: bR - 4, y: fy(-ROW) - 8, "text-anchor": "end", class: "sm" }, svgB).textContent = `0/0: ${nn} genes, not shown`;
  }

  drawA();
  drawB();
}

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

autoMount(NAME, mount);
