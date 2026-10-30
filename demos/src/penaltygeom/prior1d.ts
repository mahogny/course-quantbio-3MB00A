// data-mode="prior1d": penalty = prior, for ONE coefficient beta.
// Main plot: prior (Gaussian = ridge, Laplace = lasso), likelihood (centred on the data's
// estimate, narrower with more samples) and posterior = prior x likelihood, each scaled to the
// same height, with the posterior peak marked. Side plot: the penalty (= -2 log prior + const)
// as a parabola (ridge) or a V (lasso). sigma^2 = 1; see math.ts for the lambda conversions.
import { svgEl, htmlEl, slider, presets, button, scale } from "../lib/ui";
import { Prior, lambdaOf, penalty1, map1 } from "./math";

export const PRIOR1D_STYLE = (N: string) => `
[data-demo="${N}"] .pg-1d-main { flex: 1 1 400px; max-width: 600px; min-width: 0; display: flex; flex-direction: column; gap: .45em; }
[data-demo="${N}"] .pg-1d-side { flex: 1 1 360px; max-width: 560px; min-width: 0; display: flex; flex-direction: column; gap: .45em; }
[data-demo="${N}"] .pg-1d-main svg, [data-demo="${N}"] .pg-1d-side svg { width: 100%; }
[data-demo="${N}"] .pg-1d-side .qb-slider { grid-template-columns: 1fr 5.6em; row-gap: 0; }
[data-demo="${N}"] .pg-1d-side .qb-slider-name { grid-column: 1 / -1; white-space: normal; }
[data-demo="${N}"] .pg-1d-main .qb-readout { white-space: normal; line-height: 1.45; }
.reveal [data-demo="${N}"] .pg-1d-main { flex: 0 0 580px; width: 580px; gap: 6px; }
.reveal [data-demo="${N}"] .pg-1d-side { flex: 0 0 540px; width: 540px; gap: 6px; }
`;

const C = { prior: "#2ca02c", lik: "#777", post: "#9467bd", zero: "#d62728" };
const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2)).replace("-", "−");
const fmtLam = (lam: number) => "λ = " + (lam >= 10 ? lam.toFixed(0) : lam >= 1 ? lam.toFixed(1) : lam.toPrecision(2));
let clipId = 0;

export function mountPrior1d(host: HTMLElement): void {
  const d = host.dataset;
  const num = (v: string | undefined, def: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : def);
  const prior0: Prior = d.prior === "laplace" ? "laplace" : "gauss";
  const w0 = Math.min(3, Math.max(0.05, num(d.width, 0.5)));
  const n0 = Math.min(100, Math.max(1, Math.round(num(d.n, 5))));
  const est0 = Math.min(2.5, Math.max(-2.5, num(d.est, 1)));
  // the "how sure" slider runs on s = -log10(width): right = narrower prior = bigger lambda
  const st = { prior: prior0, s: -Math.log10(w0), ln: Math.log10(n0), est: est0 };
  const width = () => 10 ** -st.s, nOf = () => Math.round(10 ** st.ln);

  // ---------------- main plot: prior, likelihood, posterior ----------------
  const main = htmlEl("div", "pg-1d-main", "", host);
  const W = 600, H = 380, ml = 16, mr = 16, mt = 96, mb = 44, X = 3;
  const px = scale(-X, X, ml, W - mr), py = scale(0, 1, H - mb, mt);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Prior, likelihood and posterior for one coefficient beta" }, main);
  svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "#fff" }, svg);
  for (let i = -X; i <= X; i++) {
    svgEl("line", { x1: px(i), y1: mt - 10, x2: px(i), y2: H - mb, class: i === 0 ? "axis" : "grid", "stroke-width": i === 0 ? 1.5 : 1 }, svg);
    svgEl("text", { x: px(i), y: H - mb + 21, "text-anchor": "middle", "font-size": 18, fill: "#666" }, svg).textContent = String(i).replace("-", "−");
  }
  svgEl("line", { x1: ml, y1: H - mb, x2: W - mr, y2: H - mb, class: "axis", "stroke-width": 1.5 }, svg);
  svgEl("text", { x: W - mr, y: H - 4, "text-anchor": "end", "font-size": 19, "font-style": "italic" }, svg).textContent = "β";
  const priorP = svgEl("path", { fill: C.prior, "fill-opacity": 0.18, stroke: C.prior, "stroke-width": 3 }, svg);
  const likP = svgEl("polyline", { fill: "none", stroke: C.lik, "stroke-width": 3, "stroke-dasharray": "8 5" }, svg);
  const postP = svgEl("path", { fill: C.post, "fill-opacity": 0.12, stroke: C.post, "stroke-width": 4 }, svg);
  const estTick = svgEl("line", { stroke: C.lik, "stroke-width": 2.5 }, svg);
  const peakLine = svgEl("line", { stroke: C.post, "stroke-width": 2.5, "stroke-dasharray": "5 4" }, svg);
  const peakDot = svgEl("circle", { r: 8, fill: C.post, stroke: "#fff", "stroke-width": 2 }, svg);
  const halo = { stroke: "#fff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
  const peakLab = svgEl("text", { "font-size": 20, "font-weight": 700, ...halo }, svg);
  // legend across the top
  const legItems: [string, string, string][] = [["prior", C.prior, ""], ["likelihood (data)", C.lik, "8 5"], ["posterior", C.post, ""]];
  let lx = ml + 4;
  legItems.forEach(([t, col, dash]) => {
    svgEl("line", { x1: lx, y1: 22, x2: lx + 28, y2: 22, stroke: col, "stroke-width": 4, "stroke-dasharray": dash }, svg);
    const tt = svgEl("text", { x: lx + 35, y: 28, "font-size": 18 }, svg); tt.textContent = t;
    lx += 35 + t.length * 9.6 + 22;
  });
  svgEl("text", { x: ml + 4, y: 54, "font-size": 15, fill: "#888" }, svg).textContent = "curves scaled to the same height";

  const out = htmlEl("div", "qb-readout", "", main);

  // ---------------- side: penalty curve + controls ----------------
  const side = htmlEl("div", "pg-1d-side", "", host);
  const PW = 540, PH = 226, pml = 16, pmr = 16, pmt = 34, pmb = 50, YMAX = 8;
  const qx = scale(-X, X, pml, PW - pmr), qy = scale(0, YMAX, PH - pmb, pmt);
  const psv = svgEl("svg", { viewBox: `0 0 ${PW} ${PH}`, role: "img", "aria-label": "Penalty: parabola for ridge, V shape for lasso" }, side);
  svgEl("rect", { x: 0, y: 0, width: PW, height: PH, fill: "#fff" }, psv);
  const cid = `pg1d-clip-${++clipId}`;
  const cp = svgEl("clipPath", { id: cid }, psv);
  svgEl("rect", { x: pml, y: pmt, width: PW - pml - pmr, height: PH - pmt - pmb }, cp);
  for (let i = -X; i <= X; i++) {
    svgEl("line", { x1: qx(i), y1: pmt, x2: qx(i), y2: PH - pmb, class: i === 0 ? "axis" : "grid", "stroke-width": i === 0 ? 1.5 : 1 }, psv);
    svgEl("text", { x: qx(i), y: PH - pmb + 20, "text-anchor": "middle", "font-size": 16, fill: "#666" }, psv).textContent = String(i).replace("-", "−");
  }
  svgEl("line", { x1: pml, y1: PH - pmb, x2: PW - pmr, y2: PH - pmb, class: "axis", "stroke-width": 1.5 }, psv);
  svgEl("text", { x: pml, y: 22, "font-size": 19, "font-weight": 600 }, psv).textContent = "penalty";
  const penSub = svgEl("text", { x: pml + 82, y: 22, "font-size": 17, fill: "#666" }, psv);
  svgEl("text", { x: PW - pmr - 4, y: PH - pmb - 8, "text-anchor": "end", "font-size": 17, "font-style": "italic" }, psv).textContent = "β";
  const otherP = svgEl("polyline", { fill: "none", stroke: "#bbb", "stroke-width": 2, "stroke-dasharray": "6 5", "clip-path": `url(#${cid})` }, psv);
  const penP = svgEl("polyline", { fill: "none", stroke: C.prior, "stroke-width": 4, "clip-path": `url(#${cid})` }, psv);
  const tipLab = svgEl("text", { x: qx(0), y: PH - 4, "font-size": 17, "text-anchor": "middle", "font-weight": 600, fill: "#333" }, psv);
  const otherLab = svgEl("text", { "font-size": 16, fill: "#999", ...halo }, psv);

  const ctr = htmlEl("div", "", "", side);
  ctr.style.cssText = "display:flex;flex-direction:column;gap:.3em";
  const pr = presets(ctr, [
    { label: "Gaussian prior (ridge)", apply: () => { st.prior = "gauss"; draw(); } },
    { label: "Laplace prior (lasso)", apply: () => { st.prior = "laplace"; draw(); } },
  ]);
  const sS = slider(ctr, "how sure we are that β is near 0", -Math.log10(3), -Math.log10(0.05), 0.01, st.s,
    v => { st.s = v; draw(); }, v => fmtLam(lambdaOf(st.prior, 10 ** -v)));
  const sN = slider(ctr, "data strength: number of samples", 0, 2, 0.01, st.ln, v => { st.ln = v; draw(); }, v => "n = " + Math.round(10 ** v));
  const sE = slider(ctr, "β estimated from the data alone", -2.5, 2.5, 0.05, st.est, v => { st.est = v; draw(); }, v => f2(v));
  const row = htmlEl("div", "pg-row", "", ctr);
  button(row, "Reset", () => {
    st.prior = prior0; st.s = -Math.log10(w0); st.ln = Math.log10(n0); st.est = est0;
    sS.set(st.s); sN.set(st.ln); sE.set(st.est); draw();
  });

  const G: number[] = [];
  for (let i = 0; i <= 600; i++) G.push(-X + 2 * X * i / 600);       // includes beta = 0 exactly
  const line = (f: (b: number) => number) => G.map(b => `${px(b).toFixed(1)},${py(f(b)).toFixed(1)}`).join(" ");
  const area = (f: (b: number) => number) => `M${px(-X)} ${py(0)}L` + G.map(b => `${px(b).toFixed(1)} ${py(f(b)).toFixed(1)}`).join("L") + `L${px(X)} ${py(0)}Z`;

  function draw(): void {
    pr.forEach((b, i) => b.classList.toggle("active", (i === 0) === (st.prior === "gauss")));
    sS.set(st.s);                                         // refresh the lambda shown (depends on the prior)
    const w = width(), n = nOf(), est = st.est, P = st.prior;
    const lam = lambdaOf(P, w);
    // -2 log densities, up to constants
    const nlPrior = (b: number) => penalty1(P, lam, b);
    const nlLik = (b: number) => n * (b - est) ** 2;
    const peak = map1(P, lam, n, est);
    const nlPost = (b: number) => nlPrior(b) + nlLik(b) - nlPrior(peak) - nlLik(peak);
    const h = (nl: (b: number) => number) => (b: number) => Math.exp(-nl(b) / 2);
    priorP.setAttribute("d", area(h(nlPrior)));
    likP.setAttribute("points", line(h(b => nlLik(b))));
    postP.setAttribute("d", area(h(nlPost)));
    estTick.setAttribute("x1", String(px(est))); estTick.setAttribute("x2", String(px(est)));
    estTick.setAttribute("y1", String(H - mb - 10)); estTick.setAttribute("y2", String(H - mb + 4));
    const zero = peak === 0;
    const xp = px(peak);
    peakLine.setAttribute("x1", String(xp)); peakLine.setAttribute("x2", String(xp));
    peakLine.setAttribute("y1", String(py(0))); peakLine.setAttribute("y2", String(py(1)));
    peakDot.setAttribute("cx", String(xp)); peakDot.setAttribute("cy", String(py(1)));
    peakDot.setAttribute("fill", zero ? C.zero : C.post);
    peakLab.textContent = zero ? "peak: β = 0 exactly" : `peak: β = ${f2(peak)}`;
    peakLab.setAttribute("fill", zero ? C.zero : C.post);
    peakLab.setAttribute("y", String(py(1) - 16));
    const right = xp < W / 2;
    peakLab.setAttribute("x", String(xp + (right ? -10 : 10)));
    peakLab.setAttribute("text-anchor", right ? "start" : "end");

    // ---- penalty panel ----
    const other: typeof P = P === "gauss" ? "laplace" : "gauss";
    const lamO = lambdaOf(other, w);
    const qline = (f: (b: number) => number) => G.map(b => `${qx(b).toFixed(1)},${qy(Math.min(YMAX * 1.5, f(b))).toFixed(1)}`).join(" ");
    penP.setAttribute("points", qline(b => penalty1(P, lam, b)));
    otherP.setAttribute("points", qline(b => penalty1(other, lamO, b)));
    penSub.textContent = P === "gauss" ? `ridge: λβ²  (a smooth bowl), ${fmtLam(lam)}` : `lasso: λ|β|  (a V), ${fmtLam(lam)}`;
    tipLab.textContent = P === "gauss" ? "↑ smooth, flat bottom at 0" : "↑ sharp tip at 0";
    // label the faint curve where it is still inside the panel
    let bo = X;
    while (bo > 0.2 && penalty1(other, lamO, bo) > YMAX * 0.85) bo -= 0.05;
    otherLab.setAttribute("x", String(qx(-bo) + 6)); otherLab.setAttribute("y", String(qy(penalty1(other, lamO, bo)) - 6));
    otherLab.setAttribute("text-anchor", "start");
    otherLab.textContent = penalty1(other, lamO, bo) > YMAX * 0.85 ? "" : other === "gauss" ? "ridge" : "lasso";

    // ---- readout ----
    out.innerHTML = "";
    htmlEl("div", "", `prior width ${f2(w)}  ⇔  ${fmtLam(lam)}   (narrow prior = big λ)`, out);
    htmlEl("div", "", `data alone: β = ${f2(est)} from n = ${n} samples`, out);
    if (zero) htmlEl("div", "pg-zero", "posterior peak: β = 0 exactly (gene dropped)", out);
    else htmlEl("div", "", `posterior peak: β = ${f2(peak)}  (pulled ${f2(Math.abs(est - peak))} toward 0)`, out);
  }
  draw();
}
