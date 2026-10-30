// Bias–variance tradeoff, with the ridge penalty lambda as the dial. A very flexible curve
// (degree-10 polynomial, see model.ts) is fitted to a few noisy points of "expression vs dose".
// (a) the training points, the fitted curve and (optional) the true curve; "show 20 refits"
//     overlays fits to 20 other training samples at the same lambda: their spread is the
//     variance, the offset of their average from the true curve is the bias.
// (b) training error and test error (new points, never used for fitting) against lambda on a
//     log axis; the current lambda and the lambda with the lowest test error are marked.
//     Click or drag in (b) to set lambda.
// Errors are "typical misses": root mean squared difference between points and curve.
//
// Auto-mounts on <div data-demo="biasvar">. data-* options (all optional):
//   data-lambda="0.001"  starting lambda (1e-6 .. 1e3, snapped to the slider)
//   data-n="16"          training points (8..60)
//   data-seed="1"        first training sample (the 20 refits are fixed by this seed too)
//   data-refits="on"     start with the 20 refits shown
//   data-truth="off"     start with the true curve hidden
import { svgEl, htmlEl, slider, button, checkbox, scale, svgPoint, autoMount } from "../lib/ui";
import {
  sample, normal, fit, predict, rmse, truth, curves, posToLambda, lambdaToPos, POS, LOG_MIN, LOG_MAX,
  Sample, Curves,
} from "./model";

const NAME = "biasvar";
const NREFIT = 20, NTEST = 200;
const COL = { pt: "#444", fit: "var(--qb-c1)", truth: "var(--qb-c3)", train: "var(--qb-c1)", test: "var(--qb-c2)", mark: "#555" };
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .4em; }
[data-demo="${NAME}"] .bv-controls { display: flex; flex-wrap: wrap; gap: .35em 1.1em; align-items: center; width: 100%; }
[data-demo="${NAME}"] .bv-controls .qb-slider { flex: 1 1 280px; max-width: 400px; grid-template-columns: auto 1fr 4.2em; }
[data-demo="${NAME}"] .bv-controls .qb-slider output { font-family: inherit; text-align: left; }
[data-demo="${NAME}"] .bv-group { display: flex; flex-wrap: wrap; gap: .35em .9em; align-items: center; }
[data-demo="${NAME}"] .bv-plots { display: flex; flex-wrap: wrap; gap: 12px; width: 100%; }
[data-demo="${NAME}"] .bv-plots svg { flex: 1 1 380px; min-width: 0; max-width: calc(50% - 6px); height: auto; }
[data-demo="${NAME}"] .bv-plots svg.bv-b { cursor: pointer; touch-action: none; }
[data-demo="${NAME}"] svg text { font-size: 17px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 15.5px; fill: #555; }
[data-demo="${NAME}"] svg .reg { font-size: 16px; fill: #888; font-style: italic; }
[data-demo="${NAME}"] .qb-note { margin: 0; }
.reveal [data-demo="${NAME}"] { font-size: 20px; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 17px; }
.reveal [data-demo="${NAME}"] p.qb-note { margin: 0 0 .1em; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1.1em; height: 1.1em; }
@media (max-width: 760px) { [data-demo="${NAME}"] .bv-plots svg { max-width: 100%; flex-basis: 100%; } }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const pow10 = (k: number): string => (k === 0 ? "1" : k === 1 ? "10" : "10" + String(k).replace(/./g, c => SUP[c]));

/** lambda for display: plain numbers from 0.01 up, otherwise 3·10⁻⁵ style. */
function fmtLambda(l: number): string {
  if (l >= 0.01) return String(+l.toPrecision(2));
  const k = Math.floor(Math.log10(l) + 1e-9);
  const m = Math.round(l / 10 ** k);
  return m === 1 ? pow10(k) : m === 10 ? pow10(k + 1) : `${m}·${pow10(k)}`;
}
const f2 = (v: number): string => v.toFixed(2);

let uid = 0;

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const n = Math.max(8, Math.min(60, Math.round(Number(ds.n ?? 16)) || 16));
  const seed0 = Math.round(Number(ds.seed ?? 1)) || 1;
  const lam0 = Number(ds.lambda ?? 0.001);
  const pos0 = lambdaToPos(Number.isFinite(lam0) && lam0 > 0 ? lam0 : 0.001);
  const st = {
    pos: pos0, seed: seed0,
    refits: ds.refits === "on" || ds.refits === "1",
    truth: !(ds.truth === "off" || ds.truth === "0"),
  };
  const id = `bv${++uid}`;

  // refits: 20 other training samples, fixed by the first seed
  const refitNE = Array.from({ length: NREFIT }, (_, k) => normal(sample(n, 100000 + 1000 * seed0 + k)));

  let train: Sample, test: Sample, cv: Curves, ne: ReturnType<typeof normal>;
  function newData(): void {
    train = sample(n, st.seed);
    test = sample(NTEST, st.seed + 7919);
    ne = normal(train);
    cv = curves(train, test);
  }

  // ---- controls ----
  const ctr = htmlEl("div", "bv-controls", "", host);
  const sl = slider(ctr, "λ", 0, POS, 1, st.pos, v => setPos(v), v => fmtLambda(posToLambda(v)));
  const g1 = htmlEl("div", "bv-group", "", ctr);
  button(g1, "best λ", () => setPos(cv.best));
  button(g1, "new training sample", () => { st.seed++; newData(); drawAll(); });
  const g2 = htmlEl("div", "bv-group", "", ctr);
  checkbox(g2, "show 20 refits", st.refits, v => { st.refits = v; drawA(); });
  checkbox(g2, "show true curve", st.truth, v => { st.truth = v; drawA(); });
  htmlEl("p", "qb-note",
    `Expression of one gene at ${n} doses (dots), fitted with a very flexible curve. λ is the penalty dial: small λ lets the curve wiggle, large λ makes it stiff. Test error is measured on new points the fit never saw.`, host);

  const plots = htmlEl("div", "bv-plots", "", host);
  const W = 560, H = 430, pT = 84, pB = H - 52;
  const svgA = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Training points and fitted curve" }, plots);
  const svgB = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "bv-b", role: "img", "aria-label": "Training and test error against lambda" }, plots);

  function setPos(p: number): void {
    st.pos = Math.max(0, Math.min(POS, Math.round(p)));
    sl.set(st.pos);
    drawA(); drawB();
  }

  // ---------------- (a) data and fit ----------------
  const aL = 52, aR = W - 14, YMIN = -1, YMAX = 7;
  const ax = scale(0, 1, aL, aR), ay = scale(YMIN, YMAX, pB, pT);
  const XS = Array.from({ length: 161 }, (_, i) => i / 160);
  const pathOf = (f: (x: number) => number): string =>
    XS.map((x, i) => `${i ? "L" : "M"}${ax(x).toFixed(1)},${ay(Math.max(YMIN - 3, Math.min(YMAX + 3, f(x)))).toFixed(1)}`).join("");

  function drawA(): void {
    const lam = posToLambda(st.pos);
    const c = fit(ne, lam);
    svgA.replaceChildren();
    const clip = svgEl("clipPath", { id: id + "a" }, svgEl("defs", {}, svgA));
    svgEl("rect", { x: aL, y: pT, width: aR - aL, height: pB - pT }, clip);

    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgA).textContent = `(a) one training sample, λ = ${fmtLambda(lam)}`;
    rich(svgA, 8, 50, [["training error ", ""], [f2(cv.train[st.pos]), COL.train], ["   test error ", ""], [f2(cv.test[st.pos]), COL.test]]);

    for (const v of [0, 2, 4, 6]) {
      svgEl("line", { x1: aL, x2: aR, y1: ay(v), y2: ay(v), class: "grid" }, svgA);
      svgEl("text", { x: aL - 6, y: ay(v) + 5, "text-anchor": "end", class: "sm" }, svgA).textContent = String(v);
    }
    svgEl("line", { x1: aL, x2: aR, y1: pB, y2: pB, class: "axis" }, svgA);
    for (const v of [0, 0.5, 1]) {
      svgEl("line", { x1: ax(v), x2: ax(v), y1: pB, y2: pB + 5, class: "axis" }, svgA);
      svgEl("text", { x: ax(v), y: pB + 21, "text-anchor": "middle", class: "sm" }, svgA).textContent = String(v);
    }
    svgEl("text", { x: (aL + aR) / 2, y: H - 8, "text-anchor": "middle" }, svgA).textContent = "dose";
    const yc = (pT + pB) / 2;
    svgEl("text", { x: 16, y: yc, "text-anchor": "middle", transform: `rotate(-90 16 ${yc})` }, svgA).textContent = "expression";

    const g = svgEl("g", { "clip-path": `url(#${id}a)`, fill: "none" }, svgA);
    if (st.refits) {
      const fits = refitNE.map(e => fit(e, lam));
      for (const f of fits)
        svgEl("path", { d: pathOf(x => predict(f, x)), stroke: COL.fit, "stroke-width": 1.4, "stroke-opacity": 0.3 }, g);
      const mean = (x: number) => fits.reduce((s, f) => s + predict(f, x), 0) / fits.length;
      svgEl("path", { d: pathOf(mean), stroke: COL.fit, "stroke-width": 3, "stroke-dasharray": "8 5" }, g);
      // spread (variance) and offset (bias), averaged over the dose range
      let sp = 0, of = 0;
      const G = 101;
      for (let i = 0; i < G; i++) {
        const x = i / (G - 1), v = fits.map(f => predict(f, x));
        const m = v.reduce((a, b) => a + b, 0) / v.length;
        sp += v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length;
        of += (m - truth(x)) ** 2;
      }
      rich(svgA, 8, 72, [[`${NREFIT} refits: spread `, ""], [f2(Math.sqrt(sp / G)), COL.fit], [" (variance)   offset ", ""],
        [f2(Math.sqrt(of / G)), COL.truth], [" (bias)", ""]]);
    }
    if (st.truth) svgEl("path", { d: pathOf(truth), stroke: COL.truth, "stroke-width": 3.5, "stroke-opacity": 0.85 }, g);
    if (!st.refits) svgEl("path", { d: pathOf(x => predict(c, x)), stroke: COL.fit, "stroke-width": 3 }, g);
    else svgEl("path", { d: pathOf(x => predict(c, x)), stroke: COL.fit, "stroke-width": 2.5, "stroke-opacity": 0.9 }, g);
    const pts = svgEl("g", { fill: COL.pt }, svgA);
    train.x.forEach((x, i) => svgEl("circle", { cx: ax(x).toFixed(1), cy: ay(train.y[i]).toFixed(1), r: 5 }, pts));

    // legend (bottom right, inside the plot)
    const leg: [string, string, string, number][] = [["fit", COL.fit, "", 3]];
    if (st.refits) leg.push(["average of refits", COL.fit, "8 5", 3]);
    if (st.truth) leg.push(["true curve", COL.truth, "", 3.5]);
    leg.forEach(([lab, col, dash, w], i) => {
      const y = pB - 14 - 22 * (leg.length - 1 - i), x0 = aR - 190;
      svgEl("line", { x1: x0, x2: x0 + 26, y1: y, y2: y, stroke: col, "stroke-width": w, "stroke-dasharray": dash }, svgA);
      svgEl("text", { x: x0 + 32, y: y + 5, class: "sm" }, svgA).textContent = lab;
    });
  }

  // ---------------- (b) error vs lambda ----------------
  const bL = 56, bR = W - 16, EMAX = 2;
  const bx = scale(0, POS, bL, bR), by = scale(0, EMAX, pB, pT);

  function drawB(): void {
    svgB.replaceChildren();
    const clip = svgEl("clipPath", { id: id + "b" }, svgEl("defs", {}, svgB));
    svgEl("rect", { x: bL - 8, y: pT, width: bR - bL + 16, height: pB - pT + 8 }, clip);
    svgEl("text", { x: 8, y: 24, class: "ttl" }, svgB).textContent = "(b) error for every λ";
    rich(svgB, 8, 50, [["training error", COL.train], ["   test error", COL.test], ["   (typical miss)", ""]]);

    // regions either side of the best lambda
    const xb = bx(cv.best);
    svgEl("rect", { x: bL, y: pT, width: xb - bL, height: pB - pT, fill: COL.test, "fill-opacity": 0.05 }, svgB);
    svgEl("rect", { x: xb, y: pT, width: bR - xb, height: pB - pT, fill: COL.truth, "fill-opacity": 0.06 }, svgB);
    svgEl("text", { x: bL, y: pT - 8, class: "reg" }, svgB).textContent = "← overfit (high variance)";
    svgEl("text", { x: bR, y: pT - 8, class: "reg", "text-anchor": "end" }, svgB).textContent = "underfit (high bias) →";

    for (const v of [0, 0.5, 1, 1.5, 2]) {
      svgEl("line", { x1: bL, x2: bR, y1: by(v), y2: by(v), class: v === 0 ? "axis" : "grid" }, svgB);
      svgEl("text", { x: bL - 6, y: by(v) + 5, "text-anchor": "end", class: "sm" }, svgB).textContent = String(v);
    }
    for (let k = LOG_MIN; k <= LOG_MAX; k++) {
      const x = bx((k - LOG_MIN) * 10);
      svgEl("line", { x1: x, x2: x, y1: pB, y2: pB + (k % 2 === 0 ? 6 : 3), class: "axis" }, svgB);
      if (k % 2 === 0 || k === LOG_MAX)
        svgEl("text", { x, y: pB + 21, "text-anchor": "middle", class: "sm" }, svgB).textContent = pow10(k);
    }
    svgEl("text", { x: (bL + bR) / 2, y: H - 8, "text-anchor": "middle" }, svgB).textContent = "λ (log axis): wiggly ← → stiff";

    const line = (v: number[]) => v.map((e, p) => `${p ? "L" : "M"}${bx(p).toFixed(1)},${by(Math.min(e, EMAX + 1)).toFixed(1)}`).join("");
    const g = svgEl("g", { "clip-path": `url(#${id}b)`, fill: "none", "stroke-width": 3 }, svgB);
    svgEl("path", { d: line(cv.train), stroke: COL.train }, g);
    svgEl("path", { d: line(cv.test), stroke: COL.test }, g);
    if (cv.test[0] > EMAX) svgEl("text", { x: bL + 6, y: pT + 20, class: "sm" }, svgB).textContent = `↑ test error up to ${f2(cv.test[0])}`;

    // best lambda
    svgEl("line", { x1: xb, x2: xb, y1: pT, y2: pB, stroke: COL.mark, "stroke-width": 1.3, "stroke-dasharray": "5 4" }, svgB);
    const yb = by(cv.test[cv.best]);
    svgEl("circle", { cx: xb, cy: yb, r: 6, fill: "#fff", stroke: COL.test, "stroke-width": 2.5 }, svgB);
    const bt = svgEl("text", { x: xb, y: yb + 26, "text-anchor": "middle", "font-weight": 600 }, svgB);
    bt.textContent = `best λ ≈ ${fmtLambda(posToLambda(cv.best))}`;

    // current lambda
    const xc = bx(st.pos);
    svgEl("line", { x1: xc, x2: xc, y1: pT, y2: pB, stroke: "var(--qb-accent)", "stroke-width": 2, "stroke-opacity": 0.6 }, svgB);
    for (const [v, col] of [[cv.train[st.pos], COL.train], [cv.test[st.pos], COL.test]] as [number, string][])
      if (v <= EMAX) svgEl("circle", { cx: xc, cy: by(v), r: 6.5, fill: col }, svgB);
  }

  // click or drag in (b) to set lambda
  const fromPointer = (ev: PointerEvent) => setPos(bx.invert(svgPoint(svgB, ev)[0]));
  svgB.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    svgB.setPointerCapture(ev.pointerId);
    fromPointer(ev);
    const move = (e: PointerEvent) => fromPointer(e);
    const up = () => { svgB.removeEventListener("pointermove", move); svgB.removeEventListener("pointerup", up); svgB.removeEventListener("pointercancel", up); };
    svgB.addEventListener("pointermove", move);
    svgB.addEventListener("pointerup", up);
    svgB.addEventListener("pointercancel", up);
  });

  function drawAll(): void { drawA(); drawB(); }
  newData();
  drawAll();
}

/** Text with coloured parts: [text, colour or ""][] */
function rich(svg: SVGSVGElement, x: number, y: number, parts: [string, string][], cls = "sm"): void {
  const t = svgEl("text", { x, y, class: cls }, svg);
  t.style.whiteSpace = "pre";
  for (const [s, c] of parts) {
    const sp = svgEl("tspan", {}, t);
    sp.textContent = s;
    if (c) { sp.style.fill = c; sp.style.fontWeight = "600"; }
  }
}

autoMount(NAME, mount);
