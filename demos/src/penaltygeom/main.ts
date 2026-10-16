// Ridge vs lasso geometry. Two coefficients (beta1, beta2): RSS contours (ellipses around the
// draggable OLS point; their tilt/stretch follows the correlation r of the two predictors), the
// penalty region (circle = ridge, diamond = lasso, rounded diamond = elastic net, mixing alpha),
// and the penalized solution where the smallest contour touches the region. A second panel shows
// the coefficient path (beta1, beta2 vs lambda). Objective, in the decks' notation:
//   RSS + lambda * [ alpha * sum|beta_j| + (1 - alpha) * sum beta_j^2 ].
// Auto-mounts on <div data-demo="penaltygeom">. Optional attributes:
//   data-mode="prior"   draw the penalty as a prior (Gaussian / Laplace), the RSS as a likelihood,
//                       and the posterior with its peak (MAP) = the penalized solution;
//   data-ols="2 0.6"  data-corr="0.4"  data-lambda="2"  data-alpha="1".
import { svgEl, htmlEl, slider, presets, button, draggable, svgPoint, scale, numList, autoMount } from "../lib/ui";
import { V2, solve, path, pen, rss, objective, regionBoundary, ellipse, contour } from "./math";

const NAME = "penaltygeom";
const STYLE = `
[data-demo="${NAME}"] .pg-geo { flex: 1 1 400px; max-width: 520px; min-width: 0; }
[data-demo="${NAME}"] .pg-side { flex: 1 1 400px; max-width: 600px; min-width: 0; display: flex; flex-direction: column; gap: .5em; }
[data-demo="${NAME}"] .pg-side svg { width: 100%; }
[data-demo="${NAME}"] .pg-geo svg { width: 100%; }
[data-demo="${NAME}"] .qb-readout { line-height: 1.4; }
[data-demo="${NAME}"] .pg-zero { color: var(--qb-c2); font-weight: 700; }
[data-demo="${NAME}"] .pg-row { display: flex; gap: .5em; flex-wrap: wrap; align-items: center; }
.reveal [data-demo="${NAME}"] { flex-wrap: nowrap; gap: 18px; font-size: 20px; }
.reveal [data-demo="${NAME}"] .pg-geo { flex: 0 0 520px; width: 520px; }
.reveal [data-demo="${NAME}"] .pg-side { flex: 0 0 600px; width: 600px; gap: 8px; }
.reveal [data-demo="${NAME}"] .qb-slider { gap: .4em; }
.reveal [data-demo="${NAME}"] .qb-readout { font-size: 19px; padding: .3em .5em; }
`;

const COL = { b1: "#1f77b4", b2: "#ff7f0e", region: "#2ca02c", sol: "#9467bd", rss: "#999", ols: "#444" };

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const fmtLam = (L: number) => { const v = 10 ** L; return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toPrecision(2); };

function mount(host: HTMLElement): void {
  injectStyle();
  const prior = host.dataset.mode === "prior";
  const ols0 = numList(host.dataset.ols, [2, 0.6]).slice(0, 2) as V2;
  const corr0 = Number(host.dataset.corr ?? 0.4);
  const lam0 = Number(host.dataset.lambda ?? 2);
  const alpha0 = Number(host.dataset.alpha ?? 1);
  const st = { b: [...ols0] as V2, r: corr0, L: Math.log10(lam0), alpha: alpha0 };

  // ---------------- geometry panel ----------------
  const W = 520, R = 3, PAD = 6;
  const sx = scale(-R, R, PAD, W - PAD), sy = scale(-R, R, W - PAD, PAD);
  const geoBox = htmlEl("div", "pg-geo", "", host);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${W}`, role: "img",
    "aria-label": prior ? "Prior, likelihood and posterior for two coefficients" : "RSS contours and penalty region for two coefficients" }, geoBox);
  svgEl("rect", { x: 0, y: 0, width: W, height: W, fill: "#fff" }, svg);
  const grid = svgEl("g", {}, svg);
  for (let i = -R; i <= R; i++) {
    const cls = i === 0 ? "axis" : "grid";
    svgEl("line", { x1: sx(i), y1: sy(-R), x2: sx(i), y2: sy(R), class: cls, "stroke-width": i === 0 ? 2 : 1 }, grid);
    svgEl("line", { x1: sx(-R), y1: sy(i), x2: sx(R), y2: sy(i), class: cls, "stroke-width": i === 0 ? 2 : 1 }, grid);
    if (i !== 0 && Math.abs(i) < R) {
      svgEl("text", { x: sx(i), y: sy(0) + 21, "text-anchor": "middle", "font-size": 18, fill: "#888" }, grid).textContent = String(i);
      svgEl("text", { x: sx(0) - 6, y: sy(i) + 6, "text-anchor": "end", "font-size": 18, fill: "#888" }, grid).textContent = String(i);
    }
  }
  const regionG = svgEl("g", {}, svg);       // penalty region / prior shapes
  const contG = svgEl("g", {}, svg);         // RSS / likelihood contours
  const postG = svgEl("g", {}, svg);         // posterior contours (prior mode)
  const touch = svgEl("polyline", { fill: "none", stroke: COL.sol, "stroke-width": 3 }, svg);
  const zeroMark = svgEl("g", {}, svg);
  svgEl("text", { x: sx(R) - 6, y: sy(0) - 8, "text-anchor": "end", "font-size": 22, "font-style": "italic" }, svg).textContent = "β₁";
  svgEl("text", { x: sx(0) + 8, y: sy(R) + 22, "font-size": 22, "font-style": "italic" }, svg).textContent = "β₂";
  const solDot = svgEl("circle", { r: 9, fill: COL.sol, stroke: "#fff", "stroke-width": 2 }, svg);
  const halo = { stroke: "#fff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
  const solLab = svgEl("text", { "font-size": 21, "font-weight": 700, fill: COL.sol, ...halo }, svg);
  const olsG = svgEl("g", {}, svg);
  const olsC = svgEl("circle", { r: 15, class: "handle", stroke: COL.ols }, olsG);
  const olsLab = svgEl("text", { "font-size": 20, "font-weight": 600, fill: COL.ols, ...halo }, svg);
  const toWorld = (ev: PointerEvent): V2 => { const [x, y] = svgPoint(svg, ev); return [sx.invert(x), sy.invert(y)]; };
  draggable(olsC, toWorld, (x, y) => {
    const c = (v: number) => Math.max(-2.8, Math.min(2.8, Math.round(v * 20) / 20));
    st.b = [c(x), c(y)]; draw();
  });
  // legend (top-left)
  const leg = svgEl("g", {}, svg);
  svgEl("rect", { x: 8, y: 8, width: prior ? 215 : 230, height: prior ? 104 : 78, fill: "#fff", "fill-opacity": 0.9, stroke: "#ddd", rx: 6 }, leg);
  const legRows: [string, string, boolean][] = prior
    ? [["prior", COL.region, true], ["likelihood (RSS)", COL.rss, false], ["posterior", COL.sol, false], ["MAP = penalized β̂", COL.sol, true]]
    : [["penalty region", COL.region, true], ["RSS contours", COL.rss, false], ["penalized β̂", COL.sol, true]];
  legRows.forEach(([txt, col, filled], i) => {
    const y = 30 + i * 24;
    if (filled && i > 0) svgEl("circle", { cx: 26, cy: y - 6, r: 7, fill: col }, leg);
    else if (filled) svgEl("rect", { x: 16, y: y - 14, width: 20, height: 14, fill: col, "fill-opacity": 0.35, stroke: col }, leg);
    else svgEl("line", { x1: 15, y1: y - 6, x2: 37, y2: y - 6, stroke: col, "stroke-width": 2.5 }, leg);
    svgEl("text", { x: 44, y, "font-size": 18 }, leg).textContent = txt;
  });

  // ---------------- side: path panel + controls ----------------
  const side = htmlEl("div", "pg-side", "", host);
  const PW = 600, PH = 250, ml = 58, mr = 16, mt = 44, mb = 46;
  const LMIN = -2, LMAX = 2;
  const px = scale(LMIN, LMAX, ml, PW - mr);
  const psvg = svgEl("svg", { viewBox: `0 0 ${PW} ${PH}`, role: "img", "aria-label": "Coefficient path: beta1 and beta2 against lambda" }, side);
  svgEl("rect", { x: 0, y: 0, width: PW, height: PH, fill: "#fff" }, psvg);
  svgEl("text", { x: ml, y: 21, "font-size": 19, "font-weight": 600 }, psvg).textContent = "Coefficient path";
  const pathTitle2 = svgEl("text", { x: PW - mr, y: 21, "font-size": 18, "text-anchor": "end", fill: "#666" }, psvg);
  const pAxes = svgEl("g", {}, psvg);
  for (const L of [-2, -1, 0, 1, 2]) {
    svgEl("line", { x1: px(L), y1: mt, x2: px(L), y2: PH - mb, class: "grid" }, psvg);
    svgEl("text", { x: px(L), y: PH - mb + 20, "text-anchor": "middle", "font-size": 18, fill: "#666" }, psvg).textContent = fmtLam(L);
  }
  svgEl("text", { x: (ml + PW - mr) / 2, y: PH - 6, "text-anchor": "middle", "font-size": 18 }, psvg).textContent = "λ (log scale) →  more shrinkage";
  const p1 = svgEl("polyline", { fill: "none", stroke: COL.b1, "stroke-width": 3.5 }, psvg);
  const p2 = svgEl("polyline", { fill: "none", stroke: COL.b2, "stroke-width": 3.5 }, psvg);
  const lamLine = svgEl("line", { y1: mt, y2: PH - mb, stroke: COL.sol, "stroke-width": 2.5, "stroke-dasharray": "6 4" }, psvg);
  const d1 = svgEl("circle", { r: 6, fill: COL.b1 }, psvg), d2 = svgEl("circle", { r: 6, fill: COL.b2 }, psvg);
  const l1 = svgEl("text", { "font-size": 19, "font-style": "italic", fill: COL.b1, "text-anchor": "end" }, psvg);
  const l2 = svgEl("text", { "font-size": 19, "font-style": "italic", fill: COL.b2, "text-anchor": "end" }, psvg);
  l1.textContent = "β₁"; l2.textContent = "β₂";

  const ctr = htmlEl("div", "", "", side);
  ctr.style.cssText = "display:flex;flex-direction:column;gap:.35em";
  const pr = presets(ctr, [
    { label: prior ? "Gaussian prior (ridge, α = 0)" : "Ridge (α = 0)", apply: () => setAlpha(0) },
    { label: prior ? "mix (α = 0.5)" : "Elastic net (α = 0.5)", apply: () => setAlpha(0.5) },
    { label: prior ? "Laplace prior (lasso, α = 1)" : "Lasso (α = 1)", apply: () => setAlpha(1) },
  ]);
  const sAlpha = slider(ctr, "mixing α", 0, 1, 0.05, st.alpha, v => { st.alpha = v; markPreset(); draw(); });
  const sLam = slider(ctr, prior ? "λ (prior strength)" : "penalty λ", LMIN, LMAX, 0.01, st.L, v => { st.L = v; draw(); }, fmtLam);
  const sR = slider(ctr, "corr(x₁, x₂)", -0.95, 0.95, 0.05, st.r, v => { st.r = v; draw(); });
  const row = htmlEl("div", "pg-row", "", ctr);
  button(row, "Reset", () => {
    st.b = [...ols0] as V2; st.r = corr0; st.L = Math.log10(lam0); st.alpha = alpha0;
    sAlpha.set(st.alpha); sLam.set(st.L); sR.set(st.r); markPreset(); draw();
  });
  htmlEl("span", "qb-note", "drag the OLS point", row);
  const out = htmlEl("div", "qb-readout", "", ctr);

  function setAlpha(a: number): void { st.alpha = a; sAlpha.set(a); draw(); }
  function markPreset(): void { pr.forEach((b, i) => b.classList.toggle("active", Math.abs(st.alpha - [0, 0.5, 1][i]) < 1e-9)); }
  markPreset();

  const pts = (P: V2[]) => P.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

  function draw(): void {
    const { b, r, alpha } = st, lam = 10 ** st.L;
    const sol = solve(b, r, lam, alpha);
    const t = pen(sol, alpha);
    regionG.innerHTML = ""; contG.innerHTML = ""; postG.innerHTML = ""; zeroMark.innerHTML = "";

    if (!prior) {
      // penalty region at the budget the solution uses: {pen <= t}
      if (t > 1e-9) svgEl("polygon", { points: pts(regionBoundary(t, alpha)), fill: COL.region, "fill-opacity": 0.25, stroke: COL.region, "stroke-width": 2.5 }, regionG);
      for (let k = 1; k <= 14; k++) {
        const c = (0.3 * k) ** 2;
        svgEl("polyline", { points: pts(ellipse(b, r, c)), fill: "none", stroke: COL.rss, "stroke-width": 1.3 }, contG);
      }
      const cT = rss(sol, b, r);
      touch.setAttribute("points", cT > 1e-12 ? pts(ellipse(b, r, cT, 240)) : "");
    } else {
      // sigma^2 = 1:  -log prior = lambda*pen/2,  -log likelihood = RSS/2,  -log posterior = sum.
      const ks = [0.5, 1.5, 3];
      [...ks].reverse().forEach(k => {
        svgEl("polygon", { points: pts(regionBoundary(2 * k / lam, alpha)), fill: COL.region, "fill-opacity": 0.16, stroke: COL.region, "stroke-width": 1.2 }, regionG);
      });
      for (const k of ks) svgEl("polyline", { points: pts(ellipse(b, r, 2 * k)), fill: "none", stroke: COL.rss, "stroke-width": 2 }, contG);
      const fmin = objective(sol, b, r, lam, alpha);
      const f = (x: number, y: number) => objective([x, y], b, r, lam, alpha) - fmin;
      for (const k of ks) {
        const segs = contour(f, 2 * k, -R, R, -R, R, 130, 130);
        const d = segs.map(([p, q]) => `M${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}L${sx(q[0]).toFixed(1)} ${sy(q[1]).toFixed(1)}`).join("");
        svgEl("path", { d, fill: "none", stroke: COL.sol, "stroke-width": 2.5, "stroke-linecap": "round" }, postG);
      }
      touch.setAttribute("points", "");
    }

    // a coefficient that is exactly zero: highlight the axis it sits on
    const z1 = sol[0] === 0, z2 = sol[1] === 0;
    if (z1 !== z2) {
      const [x, y] = [sx(sol[0]), sy(sol[1])];
      if (z2) svgEl("line", { x1: x - 40, y1: y, x2: x + 40, y2: y, stroke: "#d62728", "stroke-width": 6, "stroke-opacity": 0.55, "stroke-linecap": "round" }, zeroMark);
      else svgEl("line", { x1: x, y1: y - 40, x2: x, y2: y + 40, stroke: "#d62728", "stroke-width": 6, "stroke-opacity": 0.55, "stroke-linecap": "round" }, zeroMark);
    }

    solDot.setAttribute("cx", String(sx(sol[0]))); solDot.setAttribute("cy", String(sy(sol[1])));
    // label on the side of the dot facing away from the OLS point
    let ux = sx(sol[0]) - sx(b[0]), uy = sy(sol[1]) - sy(b[1]);
    const ul = Math.hypot(ux, uy);
    if (ul < 1) { ux = 0.7; uy = -0.7; } else { ux /= ul; uy /= ul; }
    solLab.setAttribute("x", String(sx(sol[0]) + 30 * ux)); solLab.setAttribute("y", String(sy(sol[1]) + 26 * uy + 7));
    solLab.setAttribute("text-anchor", "middle");
    solLab.textContent = prior ? "MAP" : "β̂";
    olsC.setAttribute("cx", String(sx(b[0]))); olsC.setAttribute("cy", String(sy(b[1])));
    const right = b[0] < 1.6;
    olsLab.setAttribute("x", String(sx(b[0]) + (right ? 20 : -20))); olsLab.setAttribute("y", String(sy(b[1]) - 14));
    olsLab.setAttribute("text-anchor", right ? "start" : "end");
    olsLab.textContent = "OLS";

    // ---- path panel ----
    const Ls: number[] = [];
    for (let L = LMIN; L <= LMAX + 1e-9; L += 0.02) Ls.push(L);
    const P = path(b, r, alpha, Ls);
    let lo = 0, hi = 0;
    for (const [u, v] of P) { lo = Math.min(lo, u, v); hi = Math.max(hi, u, v); }
    if (hi - lo < 0.5) { hi += 0.25; lo -= 0.25; }
    const pad = 0.08 * (hi - lo);
    const py = scale(lo - pad, hi + pad, PH - mb, mt);
    pAxes.innerHTML = "";
    svgEl("line", { x1: ml, y1: py(0), x2: PW - mr, y2: py(0), class: "axis", "stroke-width": 1.5 }, pAxes);
    const step = hi - lo > 3 ? 1 : 0.5;
    for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) {
      svgEl("text", { x: ml - 8, y: py(v) + 6, "text-anchor": "end", "font-size": 18, fill: "#666" }, pAxes).textContent = String(+v.toFixed(1));
    }
    p1.setAttribute("points", P.map((q, i) => `${px(Ls[i]).toFixed(1)},${py(q[0]).toFixed(1)}`).join(" "));
    p2.setAttribute("points", P.map((q, i) => `${px(Ls[i]).toFixed(1)},${py(q[1]).toFixed(1)}`).join(" "));
    const xL = px(st.L);
    lamLine.setAttribute("x1", String(xL)); lamLine.setAttribute("x2", String(xL));
    d1.setAttribute("cx", String(xL)); d1.setAttribute("cy", String(py(sol[0])));
    d2.setAttribute("cx", String(xL)); d2.setAttribute("cy", String(py(sol[1])));
    // labels at the left end, nudged apart
    const y1 = py(P[0][0]), y2 = py(P[0][1]);
    l1.setAttribute("x", String(ml + 30)); l2.setAttribute("x", String(ml + 30));
    l1.setAttribute("y", String(y1 + (y1 <= y2 ? -7 : 21))); l2.setAttribute("y", String(y2 + (y2 < y1 ? -7 : 21)));
    pathTitle2.textContent = alpha === 0 ? "ridge" : alpha === 1 ? "lasso" : `elastic net, α = ${alpha.toFixed(2)}`;

    // ---- readout ----
    out.innerHTML = "";
    const line1 = htmlEl("div", "", `OLS = (${f2(b[0])}, ${f2(b[1])})   β̂ = (${f2(sol[0])}, ${f2(sol[1])})`, out);
    line1.style.whiteSpace = "pre";
    if (z1 && z2) htmlEl("div", "pg-zero", "both coefficients exactly 0", out);
    else if (z1 || z2) htmlEl("div", "pg-zero", `β${z1 ? "₁" : "₂"} = 0 exactly: predictor ${z1 ? 1 : 2} dropped`, out);
    else htmlEl("div", "", "both coefficients nonzero", out);
    if (prior) {
      const txt = alpha === 0 ? `Gaussian prior, τ² = σ²/λ = ${(1 / lam).toPrecision(2)}  (σ² = 1)`
        : alpha === 1 ? `Laplace prior, b = 2σ²/λ = ${(2 / lam).toPrecision(2)}  (σ² = 1)`
          : "blend of Gaussian and Laplace prior";
      htmlEl("div", "", txt, out);
    } else {
      htmlEl("div", "", `budget used: t = ${t.toFixed(2)}`, out);
    }
  }
  draw();
}

autoMount(NAME, mount);
