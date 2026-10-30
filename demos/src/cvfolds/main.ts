// How k-fold cross-validation chooses lambda. n samples (patients) x 34 genes (4 real, 30 noise),
// continuous response, ridge fits over a lambda grid (sim.ts).
// Left: the samples as a grid of cells coloured by fold; the held-out fold is outlined, the
// others (used to fit) are faded. Controls: k (2, 5, 10, n = LOOCV), "next fold", "run all",
// "reshuffle folds" (same data, new random folds), "samples come in pairs" (n/2 patients measured
// twice, so 2n samples) and "keep pairs in one fold" (grouped CV).
// Right: held-out error (MSE) against lambda (log axis). Each finished fold adds a row of dots;
// the black curve is their mean with ±1 SE bars. When all folds are done: lambda.min, the
// "min + 1 SE" line and lambda.1se; red ticks under the axis = lambda.min of earlier shuffles.
// Grey curve: training error of the fit on all samples. With pairs, the other CV (grouped vs
// ordinary) is drawn dashed for comparison, and a warning shows while pairs are split.
//
// Auto-mounts on <div data-demo="cvfolds">. data-* options (all optional):
//   data-k="5"        2, 5, 10 or "n" (leave-one-out)     data-n="40"   patients (20–80)
//   data-pairs="on"   start with paired samples           data-grouped="on"  start with grouped CV
//   data-seed="1"     data and first fold split            data-start="all"  start with all folds run
import { svgEl, htmlEl, button, presets, checkbox, scale, autoMount } from "../lib/ui";
import { makeData, crossValidate, trainingError, summarise, LAMBDAS, Data, CvResult } from "./sim";

const NAME = "cvfolds";
const KS = [2, 5, 10, 0];   // 0 = n (leave-one-out)
const FOLD = ["#4e79a7", "#f28e2b", "#59a14f", "#76b7b2", "#edc948", "#9c755f", "#ff9da7", "#bab0ac", "#b6992d", "#79706e"];
const COL = { cv: "#222", train: "#9a9a9a", min: "#d62728", se1: "#9467bd", comp: "#2ca02c", warn: "#d62728" };
const STYLE = `
[data-demo="${NAME}"] { gap: 14px 22px; }
[data-demo="${NAME}"] .cv-side { flex: 0 1 400px; min-width: 0; display: flex; flex-direction: column; gap: .4em; }
[data-demo="${NAME}"] .cv-plot { flex: 1 1 520px; min-width: 0; max-width: 760px; }
@media (max-width: 640px) { [data-demo="${NAME}"] .cv-plot { width: 100%; flex-basis: auto; } }
[data-demo="${NAME}"] .cv-plot svg, [data-demo="${NAME}"] .cv-side svg { width: 100%; height: auto; }
[data-demo="${NAME}"] .cv-row { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="${NAME}"] .qb-check.off { opacity: .45; }
.qb-demo[data-demo="${NAME}"] .qb-readout { line-height: 1.4; font-family: inherit; font-size: .88em; }
[data-demo="${NAME}"] .qb-readout b { font-weight: 700; }
[data-demo="${NAME}"] svg .sm { font-size: 16px; fill: #555; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
.reveal .qb-demo[data-demo="${NAME}"] { flex-wrap: nowrap; font-size: 19px; gap: 20px; margin: 0; }
.reveal [data-demo="${NAME}"] .cv-side { flex: 0 0 410px; width: 410px; gap: 6px; }
.reveal [data-demo="${NAME}"] .cv-plot { flex: 0 0 660px; width: 660px; max-width: 660px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-readout { font-size: 17px; padding: .3em .5em; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1em; height: 1em; }
@media (max-width: 640px) { [data-demo="${NAME}"] .cv-side { flex-basis: auto; width: 100%; } }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const fmtLam = (v: number): string => (v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
const f1 = (v: number): string => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
const foldCol = (f: number): string => FOLD[f % FOLD.length];
const on = (s: string | undefined): boolean => s === "on" || s === "1" || s === "true";

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const n0 = Math.max(20, Math.min(80, Math.round(Number(ds.n ?? 40)) || 40));
  const kAttr = (ds.k ?? "5").trim().toLowerCase();
  const k0 = kAttr === "n" || kAttr === "loo" || kAttr === "loocv" ? 0 : Math.max(2, Math.round(Number(kAttr)) || 5);
  const seed0 = Math.round(Number(ds.seed ?? 1)) || 1;
  const init = { k: k0, pairs: on(ds.pairs), grouped: on(ds.grouped), all: ds.start === "all" };
  const st = { ...init, foldSeed: seed0 };
  let data: Data = makeData(n0, st.pairs, seed0);
  let cv!: CvResult;
  let comp: CvResult | null = null, train: number[] = [];
  let shown = 0;                  // folds finished
  let history: number[] = [];     // lambda.min index of earlier shuffles (same settings)
  let timer = 0;
  let stepping = false;           // highlight the fold just finished (off after a reshuffle)

  // ---------------- controls (left) ----------------
  const side = htmlEl("div", "cv-side", "", host);
  const r1 = htmlEl("div", "cv-row", "", side);
  htmlEl("span", "", "folds k:", r1);
  const kBtns = presets(r1, KS.map(k => ({ label: k ? String(k) : "n (LOOCV)", apply: () => { st.k = k; settingsChanged(); } })));
  const r2 = htmlEl("div", "cv-row", "", side);
  const bNext = button(r2, "next fold", () => { stop(); stepping = true; shown = shown >= cv.k ? 1 : shown + 1; draw(); });
  button(r2, "run all", () => runAll());
  button(r2, "reshuffle folds", () => {
    stop();
    if (shown >= cv.k) history.push(cv.iMin);
    st.foldSeed++; compute(); shown = cv.k; stepping = false; draw();
  });
  button(r2, "reset", () => {
    stop(); Object.assign(st, init, { foldSeed: seed0 });
    cbPairs.checked = st.pairs; cbGroup.checked = st.grouped;
    data = makeData(n0, st.pairs, seed0); settingsChanged(); if (init.all) { shown = cv.k; draw(); }
  });
  const cbPairs = checkbox(side, "samples come in pairs (same patient twice)", st.pairs, v => {
    st.pairs = v; data = makeData(n0, st.pairs, seed0); settingsChanged();
  });
  const cbGroup = checkbox(side, "keep pairs in one fold (grouped CV)", st.grouped, v => { st.grouped = v; settingsChanged(); });
  const groupLab = cbGroup.parentElement as HTMLElement;

  // strip of samples
  const SW = 400;
  const strip = svgEl("svg", { viewBox: `0 0 ${SW} 100`, "font-size": 18, role: "img", "aria-label": "Samples coloured by fold; the held-out fold is outlined" }, side);
  const readout = htmlEl("div", "qb-readout", "", side);

  // ---------------- plot (right) ----------------
  const plotBox = htmlEl("div", "cv-plot", "", host);
  // a narrower viewBox on a phone, so the text stays readable
  const narrow = host.clientWidth > 0 && host.clientWidth < 560;
  const W = narrow ? 540 : 680, H = narrow ? 500 : 580, ml = 60, mr = 18, mt = 98, mb = 54;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, "font-size": 18, role: "img", "aria-label": "Held-out error against lambda for each fold, with the mean CV error curve" }, plotBox);
  svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "#fff" }, svg);
  const L0 = Math.log10(LAMBDAS[0]), L1 = Math.log10(LAMBDAS[LAMBDAS.length - 1]);
  const px = scale(L0 - 0.08, L1 + 0.08, ml, W - mr);
  const xl = (i: number): number => px(Math.log10(LAMBDAS[i]));
  const clipId = `cv-clip-${Math.random().toString(36).slice(2, 8)}`;
  const defs = svgEl("defs", {}, svg);
  svgEl("rect", { x: ml, y: mt - 2, width: W - mr - ml, height: H - mb - mt + 2 }, svgEl("clipPath", { id: clipId }, defs));
  const gAxes = svgEl("g", {}, svg);
  const gData = svgEl("g", { "clip-path": `url(#${clipId})` }, svg);
  const gTop = svgEl("g", {}, svg);

  function compute(): void {
    const k = st.k || data.n;
    cv = crossValidate(data, k, st.pairs && st.grouped, st.foldSeed);
    comp = st.pairs ? crossValidate(data, k, !st.grouped, st.foldSeed) : null;
    train = trainingError(data);
  }

  function settingsChanged(): void {
    stop();
    history = [];
    compute();
    shown = 0; stepping = false;
    draw();
  }

  function stop(): void { if (timer) { clearInterval(timer); timer = 0; } }

  function runAll(): void {
    stop();
    stepping = true;
    if (shown >= cv.k) shown = 0;
    const dt = Math.max(50, Math.min(380, 2400 / cv.k));
    timer = window.setInterval(() => {
      shown++; draw();
      if (shown >= cv.k) stop();
    }, dt);
    shown++; draw();
  }

  // ---------------- drawing ----------------
  function drawStrip(): void {
    const n = data.n, pairs = st.pairs;
    const cols = n <= 48 ? 8 : 16;
    const rows = Math.ceil(n / cols);
    const top = 52;
    const inGap = pairs ? 1 : 6, pairGap = pairs ? 9 : 6;
    const nPairGaps = pairs ? cols / 2 - 1 : 0;
    const cw = (SW - 4 - (cols - 1 - nPairGaps) * inGap - nPairGaps * pairGap) / cols;
    const ch = Math.min(30, Math.max(cw, 24));
    const fs = Math.min(15, cw * 0.6);
    const H2 = top + rows * (ch + 8) + 4;
    strip.setAttribute("viewBox", `0 0 ${SW} ${H2}`);
    strip.replaceChildren();
    const cur = stepping && shown >= 1 && shown < cv.k ? shown - 1 : -1;
    // caption
    const loo = !st.k;
    const unitTxt = pairs && st.grouped ? "patients" : "samples";
    let cap1: string, cap2: string;
    if (cur >= 0) {
      let nt = 0;
      for (let i = 0; i < n; i++) if (cv.fold[i] === cur) nt++;
      cap1 = `fold ${cur + 1} of ${cv.k} held out`;
      cap2 = `test on ${nt}, fit on ${n - nt} samples`;
    } else {
      const what = pairs ? `${n} samples (${data.nUnits} patients)` : `${n} samples`;
      cap1 = loo ? `${what}: leave one out` : `${what} in ${cv.k} folds`;
      const per = loo ? ` (one ${unitTxt === "patients" ? "patient" : "sample"} each)` : "";
      cap2 = shown >= cv.k ? `all ${cv.k} folds done${per}` : `${cv.k} folds${per}: press next fold`;
    }
    svgEl("text", { x: 2, y: 20, class: "ttl" }, strip).textContent = cap1;
    svgEl("text", { x: 2, y: 42, class: "sm" }, strip).textContent = cap2;
    // pairs: a wider gap after every second column, so twins sit side by side
    const xOf = (c: number): number => {
      const pg = pairs ? Math.floor(c / 2) : 0;
      return 2 + c * cw + (c - pg) * inGap + pg * pairGap;
    };
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = xOf(c);
      const y = top + r * (ch + 8);
      const f = cv.fold[i];
      const held = f === cur;
      const faded = cur >= 0 && !held;
      if (pairs && c % 2 === 0)
        svgEl("rect", { x: x - 2, y: y - 2, width: 2 * cw + inGap + 4, height: ch + 4, rx: 6, fill: "none", stroke: "#999", "stroke-width": 1.2 }, strip);
      svgEl("rect", {
        x, y, width: cw, height: ch, rx: 4, fill: foldCol(f), "fill-opacity": faded ? 0.25 : 0.9,
        stroke: held ? "#111" : "none", "stroke-width": held ? 3 : 0,
      }, strip);
      if (!loo) {
        const t = svgEl("text", { x: x + cw / 2, y: y + ch / 2 + fs * 0.36, "text-anchor": "middle", "font-size": fs, "font-weight": held ? 700 : 400 }, strip);
        t.style.fill = faded ? "#999" : "#fff";
        if (held) t.style.fill = "#111";
        t.textContent = String(f + 1);
      }
    }
  }

  function drawPlot(): void {
    gAxes.replaceChildren(); gData.replaceChildren(); gTop.replaceChildren();
    const Ln = LAMBDAS.length;
    const ref = Math.max(cv.mean[Ln - 1], comp ? comp.mean[Ln - 1] : 0);
    const step = niceStep(1.3 * ref / 4);
    const yTop = Math.ceil(1.3 * ref / step) * step;
    const py = scale(0, yTop, H - mb, mt);

    // axes
    for (let v = 0; v <= yTop + 1e-9; v += step) {
      svgEl("line", { x1: ml, x2: W - mr, y1: py(v), y2: py(v), class: v === 0 ? "axis" : "grid" }, gAxes);
      svgEl("text", { x: ml - 7, y: py(v) + 6, "text-anchor": "end", class: "sm" }, gAxes).textContent = String(+v.toFixed(2));
    }
    for (const e of [-1, 0, 1, 2, 3]) {
      const x = px(e);
      svgEl("line", { x1: x, x2: x, y1: H - mb, y2: H - mb + 6, class: "axis" }, gAxes);
      svgEl("text", { x, y: H - mb + 24, "text-anchor": "middle", class: "sm" }, gAxes).textContent = String(10 ** e);
    }
    svgEl("text", { x: (ml + W - mr) / 2, y: H - 8, "text-anchor": "middle" }, gAxes).textContent = "λ (log scale) →  more shrinkage";
    const yc = (mt + H - mb) / 2;
    svgEl("text", { x: 18, y: yc, "text-anchor": "middle", transform: `rotate(-90 18 ${yc})` }, gAxes).textContent = "prediction error (MSE)";

    // training error
    const line = (vals: number[], attrs: Record<string, string | number>, g: SVGGElement = gData) =>
      svgEl("polyline", { points: vals.map((v, i) => `${xl(i).toFixed(1)},${py(v).toFixed(1)}`).join(" "), fill: "none", ...attrs }, g);
    line(train, { stroke: COL.train, "stroke-width": 2.5, "stroke-opacity": 0.8 });
    const tl = svgEl("text", { x: xl(1), y: py(train[1]) - 9, class: "sm" }, gData);
    tl.style.fill = COL.train; tl.textContent = "training error";

    // per-fold dots
    const m = Math.min(shown, cv.k);
    const big = cv.k <= 10;
    for (let f = 0; f < m; f++) {
      const last = f === m - 1 && m < cv.k;
      const g = svgEl("g", { fill: foldCol(f), "fill-opacity": last ? 1 : big ? 0.55 : 0.35 }, gData);
      if (last) line(cv.foldErr[f], { stroke: foldCol(f), "stroke-width": 1.8 }, g);
      cv.foldErr[f].forEach((v, i) => svgEl("circle", { cx: xl(i).toFixed(1), cy: py(v).toFixed(1), r: last ? 4.5 : big ? 3.2 : 2.4 }, g));
    }

    // comparison curve (all folds), once done
    const done = m >= cv.k;
    if (done && comp) {
      line(comp.mean, { stroke: COL.comp, "stroke-width": 3, "stroke-dasharray": "8 5" });
      const iL = Math.round(Ln * 0.3);
      const lab = svgEl("text", { x: xl(iL), y: Math.max(mt + 16, py(comp.mean[iL]) - 10), "font-weight": 600 }, gData);
      lab.style.fill = COL.comp;
      lab.textContent = st.grouped ? "ordinary CV (pairs split)" : "grouped CV (pairs kept together)";
    }

    // mean ± SE so far
    if (m >= 1) {
      const s = summarise(cv.foldErr, m);
      if (m >= 2) {
        const g = svgEl("g", { stroke: COL.cv, "stroke-width": 1.4 }, gData);
        s.mean.forEach((v, i) => {
          if (i % 2 && i !== s.iMin) return;
          const x = xl(i), y0 = py(v - s.se[i]), y1 = py(v + s.se[i]);
          svgEl("line", { x1: x, x2: x, y1: y0, y2: y1 }, g);
          svgEl("line", { x1: x - 4, x2: x + 4, y1: y0, y2: y0 }, g);
          svgEl("line", { x1: x - 4, x2: x + 4, y1: y1, y2: y1 }, g);
        });
      }
      line(s.mean, { stroke: COL.cv, "stroke-width": 3.5 });
    }

    // lambda.min, 1-SE threshold, lambda.1se
    if (done) {
      const xm = xl(cv.iMin), x1 = xl(cv.i1se), thr = cv.mean[cv.iMin] + cv.se[cv.iMin];
      svgEl("line", { x1: xm, x2: W - mr, y1: py(thr), y2: py(thr), stroke: COL.se1, "stroke-width": 2, "stroke-dasharray": "3 4" }, gTop);
      const tt = svgEl("text", { x: W - mr - 4, y: py(thr) - 7, "text-anchor": "end", "font-size": 16, "font-weight": 600 }, gTop);
      tt.style.fill = COL.se1; tt.textContent = "min + 1 SE";
      for (const [x, col, txt, row] of [[xm, COL.min, "lambda.min", 0], [x1, COL.se1, "lambda.1se", 1]] as [number, string, string, number][]) {
        svgEl("line", { x1: x, x2: x, y1: mt + row * 22, y2: H - mb, stroke: col, "stroke-width": 2.2, "stroke-dasharray": "6 4" }, gTop);
        const anchor = x > W - 120 ? "end" : x < ml + 60 ? "start" : "middle";
        const t = svgEl("text", { x, y: mt + 16 + row * 22, "text-anchor": anchor, "font-size": 17, "font-weight": 700, stroke: "#fff", "stroke-width": 4, "paint-order": "stroke" }, gTop);
        t.style.fill = col; t.textContent = txt;
      }
      svgEl("circle", { cx: xm, cy: py(cv.mean[cv.iMin]), r: 6, fill: COL.min, stroke: "#fff", "stroke-width": 1.5 }, gTop);
      svgEl("circle", { cx: x1, cy: py(cv.mean[cv.i1se]), r: 6, fill: COL.se1, stroke: "#fff", "stroke-width": 1.5 }, gTop);
    }
    // lambda.min of earlier shuffles: ticks under the axis
    for (const i of history) {
      const x = xl(i);
      svgEl("path", { d: `M${x},${H - mb + 3} l-5,9 h10 z`, fill: COL.min, "fill-opacity": 0.55 }, gTop);
    }

    // title + legend
    const ttl = svgEl("text", { x: 4, y: 22, class: "ttl" }, gTop);
    ttl.textContent = m === 0 ? "CV error: no folds run yet" : done ? `CV error: mean of all ${cv.k} folds` : `CV error so far: ${m} of ${cv.k} folds`;
    const lg = svgEl("g", {}, gTop);
    let lx = 4;
    const item = (draw: (x: number) => void, txt: string, w: number) => {
      draw(lx); svgEl("text", { x: lx + 26, y: 48, class: "sm" }, lg).textContent = txt; lx += w;
    };
    item(x => { svgEl("circle", { cx: x + 10, cy: 43, r: 4.5, fill: foldCol(0) }, lg); }, "one fold", 100);
    item(x => { svgEl("line", { x1: x, x2: x + 20, y1: 43, y2: 43, stroke: COL.cv, "stroke-width": 3.5 }, lg); }, "mean ± 1 SE", 128);
    item(x => { svgEl("line", { x1: x, x2: x + 20, y1: 43, y2: 43, stroke: COL.train, "stroke-width": 2.5 }, lg); }, "training error", 138);
    if (history.length)
      item(x => { svgEl("path", { d: `M${x + 10},${37} l-5,9 h10 z`, fill: COL.min, "fill-opacity": 0.55 }, lg); }, "earlier shuffles", 150);
    if (st.pairs && !st.grouped && m > 0) {
      const w = svgEl("text", { x: 4, y: 74, "font-weight": 700 }, gTop);
      w.style.fill = COL.warn; w.textContent = "⚠ twins split across folds: CV error too optimistic";
    } else {
      svgEl("text", { x: 4, y: 74, class: "sm" }, gTop).textContent = m === 0
        ? "press next fold: fit on the other folds, test on the held-out one"
        : "each dot: error on one held-out fold at one λ";
    }
  }

  function drawReadout(): void {
    const done = shown >= cv.k;
    const lines: string[] = [];
    if (done) {
      lines.push(`<b style="color:${COL.min}">lambda.min</b> = ${fmtLam(LAMBDAS[cv.iMin])} (CV error ${f1(cv.mean[cv.iMin])} ± ${f1(cv.se[cv.iMin])})`);
      lines.push(`<b style="color:${COL.se1}">lambda.1se</b> = ${fmtLam(LAMBDAS[cv.i1se])} (largest λ with error ≤ ${f1(cv.mean[cv.iMin] + cv.se[cv.iMin])})`);
      if (comp) {
        const c = comp;
        lines.push(`<span style="color:${COL.comp}">${st.grouped ? "ordinary" : "grouped"} CV</span>: lambda.min = ${fmtLam(LAMBDAS[c.iMin])}, error ${f1(c.mean[c.iMin])}`);
      }
    } else {
      lines.push(`Run all ${cv.k} folds to choose λ.`);
      lines.push(`Each fold: fit on the other folds at every λ, then measure the error on the held-out fold.`);
    }
    if (history.length) lines.push(`earlier shuffles: lambda.min = ${history.slice(-6).map(i => fmtLam(LAMBDAS[i])).join(", ")}`);
    readout.innerHTML = lines.join("<br>");
  }

  function draw(): void {
    kBtns.forEach((b, i) => b.classList.toggle("active", KS[i] === st.k));
    cbGroup.disabled = !st.pairs;
    groupLab.classList.toggle("off", !st.pairs);
    bNext.textContent = shown >= cv.k ? "start again" : "next fold";
    drawStrip(); drawPlot(); drawReadout();
  }

  compute();
  if (init.all) shown = cv.k;
  draw();
}

autoMount(NAME, mount);
