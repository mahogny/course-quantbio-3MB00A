// data-mode="resample": correlated genes make OLS coefficients unstable; a penalty stabilises them.
// Draws `draws` small training sets (two genes with correlation r, y = gene1 + gene2 + noise),
// fits OLS and ridge (or lasso) to each, and plots every (beta1, beta2) estimate in the
// coefficient plane: two point clouds, with their ranges in a table. No eigenvalues needed.
// The base random numbers are fixed per seed, so moving a slider re-fits the SAME draws
// (the clouds morph smoothly); the button moves on to the next seed.
import { svgEl, htmlEl, slider, presets, button, scale, rng } from "../lib/ui";
import { V2, baseNormals, makeData, ridgeFit, lassoFit } from "./math";

export const RESAMPLE_STYLE = (N: string) => `
[data-demo="${N}"] .pg-rs-plane { flex: 1 1 400px; max-width: 520px; min-width: 0; }
[data-demo="${N}"] .pg-rs-plane svg, [data-demo="${N}"] .pg-rs-side svg { width: 100%; }
[data-demo="${N}"] .pg-rs-side { flex: 1 1 380px; max-width: 600px; min-width: 0; display: flex; flex-direction: column; gap: .45em; }
[data-demo="${N}"] .pg-rs-tab { border-collapse: collapse; font-size: .92em; width: 100%; }
[data-demo="${N}"] .pg-rs-tab th, [data-demo="${N}"] .pg-rs-tab td { padding: .1em .4em; text-align: left; white-space: nowrap; border: 0; }
[data-demo="${N}"] .pg-rs-tab thead th { color: var(--qb-muted); font-weight: 500; border-bottom: 1px solid #ccc; }
[data-demo="${N}"] .pg-rs-tab td { font-family: ui-monospace, monospace; }
.reveal [data-demo="${N}"] .pg-rs-plane { flex: 0 0 520px; width: 520px; }
.reveal [data-demo="${N}"] .pg-rs-side { flex: 0 0 600px; width: 600px; gap: 6px; }
.reveal [data-demo="${N}"] .pg-rs-tab { font-size: 18px; }
@media (max-width: 640px) { [data-demo="${N}"] .pg-rs-tab { font-size: .8em; } }
`;

const C = { ols: "#ff7f0e", pen: "#9467bd", truth: "#222", line: "#888", x: "#1f77b4" };
const f1 = (v: number) => (Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1)).replace("-", "−");
const fmtLam = (L: number) => { const v = 10 ** L; return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2); };

export function mountResample(host: HTMLElement): void {
  const d = host.dataset;
  const num = (v: string | undefined, def: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : def);
  const corr0 = Math.min(0.99, Math.max(0, num(d.corr, 0.95)));
  const lam0 = num(d.lambda, 5);
  const n = Math.max(5, Math.round(num(d.n, 20)));
  const sigma = num(d.noise, 1);
  const draws = Math.max(5, Math.round(num(d.draws, 50)));
  const seed0 = Math.round(num(d.seed, 1));
  const meth0: "ridge" | "lasso" = d.method === "lasso" ? "lasso" : "ridge";
  const st = { r: corr0, L: Math.log10(lam0), meth: meth0, seed: seed0 };
  let Z = baseNormals(rng(st.seed).norm, draws, n);

  // ---------------- coefficient plane ----------------
  const W = 520, LO = -3, HI = 5, PAD = 6;
  const sx = scale(LO, HI, PAD, W - PAD), sy = scale(LO, HI, W - PAD, PAD);
  const box = htmlEl("div", "pg-rs-plane", "", host);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${W}`, role: "img",
    "aria-label": "Estimated coefficients beta1, beta2 from many resampled training sets: OLS and penalized" }, box);
  svgEl("rect", { x: 0, y: 0, width: W, height: W, fill: "#fff" }, svg);
  for (let i = LO; i <= HI; i++) {
    const cls = i === 0 ? "axis" : "grid", w = i === 0 ? 2 : 1;
    svgEl("line", { x1: sx(i), y1: sy(LO), x2: sx(i), y2: sy(HI), class: cls, "stroke-width": w }, svg);
    svgEl("line", { x1: sx(LO), y1: sy(i), x2: sx(HI), y2: sy(i), class: cls, "stroke-width": w }, svg);
    if (i !== 0 && i > LO && i < HI) {
      svgEl("text", { x: sx(i), y: sy(0) + 21, "text-anchor": "middle", "font-size": 18, fill: "#888" }, svg).textContent = String(i).replace("-", "−");
      svgEl("text", { x: sx(0) - 6, y: sy(i) + 6, "text-anchor": "end", "font-size": 18, fill: "#888" }, svg).textContent = String(i).replace("-", "−");
    }
  }
  // the line beta1 + beta2 = 2: what the data pin down well
  svgEl("line", { x1: sx(-3), y1: sy(5), x2: sx(5), y2: sy(-3), stroke: C.line, "stroke-width": 2, "stroke-dasharray": "7 5" }, svg);
  const halo = { stroke: "#fff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
  const lx = sx(-2.05), ly = sy(2.85);   // below-left of the line (sum 0.8), clear of the clouds
  svgEl("text", { x: lx, y: ly, "font-size": 18, fill: "#555", "text-anchor": "middle", ...halo,
    transform: `rotate(45 ${lx} ${ly})` }, svg).textContent = "β₁ + β₂ = 2";
  svgEl("text", { x: sx(HI) - 6, y: sy(0) - 8, "text-anchor": "end", "font-size": 20, "font-style": "italic", ...halo }, svg).textContent = "β₁ (gene 1)";
  svgEl("text", { x: sx(0) + 8, y: sy(HI) + 22, "font-size": 20, "font-style": "italic", ...halo }, svg).textContent = "β₂ (gene 2)";
  const olsG = svgEl("g", {}, svg), penG = svgEl("g", {}, svg);
  // true beta = (1, 1)
  const tx = sx(1), ty = sy(1);
  svgEl("path", { d: `M${tx - 9} ${ty - 9}L${tx + 9} ${ty + 9}M${tx - 9} ${ty + 9}L${tx + 9} ${ty - 9}`, stroke: "#fff", "stroke-width": 7 }, svg);
  svgEl("path", { d: `M${tx - 9} ${ty - 9}L${tx + 9} ${ty + 9}M${tx - 9} ${ty + 9}L${tx + 9} ${ty - 9}`, stroke: C.truth, "stroke-width": 3.5 }, svg);
  // legend
  const leg = svgEl("g", {}, svg);
  leg.setAttribute("transform", `translate(0 ${W - 98})`);      // bottom-left: empty in every setting
  svgEl("rect", { x: 8, y: 8, width: 200, height: 82, fill: "#fff", "fill-opacity": 0.92, stroke: "#ddd", rx: 6 }, leg);
  svgEl("circle", { cx: 26, cy: 24, r: 6, fill: C.ols, "fill-opacity": 0.75 }, leg);
  svgEl("text", { x: 42, y: 30, "font-size": 18 }, leg).textContent = "OLS";
  svgEl("circle", { cx: 26, cy: 48, r: 6, fill: C.pen, "fill-opacity": 0.75 }, leg);
  const legPen = svgEl("text", { x: 42, y: 54, "font-size": 18 }, leg);
  svgEl("path", { d: "M20 66L32 78M20 78L32 66", stroke: C.truth, "stroke-width": 3 }, leg);
  svgEl("text", { x: 42, y: 78, "font-size": 18 }, leg).textContent = "true β = (1, 1)";

  // ---------------- side: one training set, controls, table ----------------
  const side = htmlEl("div", "pg-rs-side", "", host);
  const SW = 600, SH = 200, SQ = 170, sx0 = 50, sy0 = 6;
  const ssv = svgEl("svg", { viewBox: `0 0 ${SW} ${SH}`, role: "img", "aria-label": "Gene 1 against gene 2 in one training set" }, side);
  svgEl("rect", { x: 0, y: 0, width: SW, height: SH, fill: "#fff" }, ssv);
  const gx = scale(-3, 3, sx0, sx0 + SQ), gy = scale(-3, 3, sy0 + SQ, sy0);
  svgEl("rect", { x: sx0, y: sy0, width: SQ, height: SQ, fill: "none", stroke: "#ccc" }, ssv);
  svgEl("line", { x1: gx(0), y1: sy0, x2: gx(0), y2: sy0 + SQ, class: "grid" }, ssv);
  svgEl("line", { x1: sx0, y1: gy(0), x2: sx0 + SQ, y2: gy(0), class: "grid" }, ssv);
  svgEl("text", { x: sx0 + SQ / 2, y: sy0 + SQ + 19, "font-size": 16, "text-anchor": "middle", fill: "#555" }, ssv).textContent = "gene 1";
  svgEl("text", { x: sx0 - 10, y: sy0 + SQ / 2, "font-size": 16, "text-anchor": "middle", fill: "#555",
    transform: `rotate(-90 ${sx0 - 10} ${sy0 + SQ / 2})` }, ssv).textContent = "gene 2";
  const dots = svgEl("g", {}, ssv);
  const tx0 = sx0 + SQ + 26;
  const cap = [
    svgEl("text", { x: tx0, y: 40, "font-size": 18, "font-weight": 600 }, ssv),
    svgEl("text", { x: tx0, y: 70, "font-size": 18 }, ssv),
    svgEl("text", { x: tx0, y: 112, "font-size": 18, fill: "#555" }, ssv),
    svgEl("text", { x: tx0, y: 138, "font-size": 18, fill: "#555" }, ssv),
  ];
  cap[0].textContent = `one of the ${draws} training sets`;
  cap[2].textContent = "true model: y = gene 1 + gene 2";
  cap[3].textContent = `+ noise, n = ${n} samples per set`;

  const ctr = htmlEl("div", "", "", side);
  ctr.style.cssText = "display:flex;flex-direction:column;gap:.3em";
  const pr = presets(ctr, [
    { label: "OLS vs ridge", apply: () => { st.meth = "ridge"; draw(); } },
    { label: "OLS vs lasso", apply: () => { st.meth = "lasso"; draw(); } },
  ]);
  const sR = slider(ctr, "corr(gene 1, gene 2)", 0, 0.99, 0.01, st.r, v => { st.r = v; draw(); });
  const sL = slider(ctr, "penalty λ", -1, 2, 0.01, st.L, v => { st.L = v; draw(); }, fmtLam);
  const row = htmlEl("div", "pg-row", "", ctr);
  button(row, `resample ${draws} datasets`, () => { st.seed++; Z = baseNormals(rng(st.seed).norm, draws, n); draw(); }, "active");
  button(row, "Reset", () => {
    st.r = corr0; st.L = Math.log10(lam0); st.meth = meth0; st.seed = seed0;
    Z = baseNormals(rng(st.seed).norm, draws, n); sR.set(st.r); sL.set(st.L); draw();
  });
  const out = htmlEl("div", "qb-readout", "", side);
  out.style.whiteSpace = "normal";

  const dot = (g: SVGGElement, b: V2, col: string) => {
    const inside = b[0] >= LO && b[0] <= HI && b[1] >= LO && b[1] <= HI;
    const c = (v: number) => Math.max(LO + 0.08, Math.min(HI - 0.08, v));
    svgEl("circle", inside
      ? { cx: sx(b[0]), cy: sy(b[1]), r: 5.5, fill: col, "fill-opacity": 0.6, stroke: col, "stroke-width": 1 }
      : { cx: sx(c(b[0])), cy: sy(c(b[1])), r: 5.5, fill: "#fff", stroke: col, "stroke-width": 2 }, g);
    return inside;
  };
  const range = (v: number[]) => `${f1(Math.min(...v))} to ${f1(Math.max(...v))}`;

  function draw(): void {
    pr.forEach((b, i) => b.classList.toggle("active", (i === 0) === (st.meth === "ridge")));
    const lam = 10 ** st.L, name = st.meth;
    legPen.textContent = name;
    olsG.innerHTML = ""; penG.innerHTML = ""; dots.innerHTML = "";
    const O: V2[] = [], P: V2[] = [];
    let outside = 0;
    Z.forEach((z, k) => {
      const { s, x } = makeData(z, st.r, sigma);
      const o = ridgeFit(s, 0), p = name === "ridge" ? ridgeFit(s, lam) : lassoFit(s, lam);
      O.push(o); P.push(p);
      if (!dot(olsG, o, C.ols)) outside++;
      if (!dot(penG, p, C.pen)) outside++;
      if (k === 0) {
        for (const [a, b] of x) svgEl("circle", { cx: gx(Math.max(-3, Math.min(3, a))), cy: gy(Math.max(-3, Math.min(3, b))), r: 4.5, fill: C.x, "fill-opacity": 0.7 }, dots);
        const sc = s.a12 / Math.sqrt(s.a11 * s.a22);
        cap[1].textContent = `corr in this set: ${sc.toFixed(2)}`;
      }
    });
    const zeros = name === "lasso" ? P.filter(b => b[0] === 0 || b[1] === 0).length : 0;

    out.innerHTML = "";
    const tab = htmlEl("table", "pg-rs-tab", "", out);
    const hr = htmlEl("tr", "", "", htmlEl("thead", "", "", tab));
    for (const h of ["", "β₁ ranges", "β₂ ranges", "β₁ + β₂"]) htmlEl("th", "", h, hr);
    const tb = htmlEl("tbody", "", "", tab);
    for (const [lab, B, col] of [["OLS", O, C.ols], [name, P, C.pen]] as [string, V2[], string][]) {
      const tr = htmlEl("tr", "", "", tb);
      const th = htmlEl("th", "", lab, tr); th.style.color = col;
      htmlEl("td", "", range(B.map(b => b[0])), tr);
      htmlEl("td", "", range(B.map(b => b[1])), tr);
      htmlEl("td", "", range(B.map(b => b[0] + b[1])), tr);
    }
    const notes: string[] = [];
    if (zeros) notes.push(`lasso set a gene to exactly 0 in ${zeros} of ${draws} sets`);
    if (outside) notes.push("hollow dots: beyond the edge");
    if (notes.length) htmlEl("div", "qb-note", notes.join(" · "), out);
  }
  draw();
}
