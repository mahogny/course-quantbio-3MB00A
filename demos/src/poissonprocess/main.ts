// One random process, two views. Events (mutations, reads, spikes …) fall at random along a line
// (a genome in Mb, or time) at a chosen rate.
//  - strip: the first few units of the line, with the events as ticks, the windows (counts view)
//    and the gaps between neighbouring events (gaps view);
//  - counts: the line cut into windows; histogram of events per window, Poisson expected as dots;
//    readout mean and variance;
//  - gaps: histogram of distances between neighbouring events, exponential expected as a curve;
//    readout mean gap vs 1 / rate.
//  - "memoryless": keep only the gaps longer than s and show what is left after s (the remaining
//    wait); it has the same shape as all gaps. Under "clumped" it does not.
//  - "clumped": events come in bursts (sim.ts), so variance > mean: a bridge to the negative binomial.
// Changing the window re-cuts the same events; changing the rate or "draw again" redraws them.
//
// Auto-mounts on <div data-demo="poissonprocess">. data-* options (all optional):
//   data-rate="2"      events per unit, 0.5–10 (step 0.5)
//   data-window="1"    window length, 0.5–5 (step 0.5)
//   data-view="both"   counts | gaps | both
//   data-wait="0.5"    initial "already waited" s, 0–3
//   data-memoryless="on"  data-clumped="on"   start with the toggle on
//   data-unit="Mb"     Mb (genome, default) or a time unit such as s or min
//   data-seed="1"
import { svgEl, htmlEl, slider, button, presets, checkbox, scale, autoMount } from "../lib/ui";
import { poisPmf, quantile } from "../nbdisp/stats";
import { simulate, windowCounts, gaps, meanVar } from "./sim";

const NAME = "poissonprocess";
const L = 2000;            // length of the whole line
const COL = { ev: "var(--qb-fg)", bar: "var(--qb-c1)", exp: "var(--qb-c2)", rem: "var(--qb-c4)", all: "#888", gapA: "var(--qb-c3)", gapB: "var(--qb-c5)" };
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .4em; }
[data-demo="${NAME}"] .pp-row { display: flex; flex-wrap: wrap; gap: .3em 1.1em; align-items: center; width: 100%; }
[data-demo="${NAME}"] .pp-row .qb-slider { flex: 0 1 16em; grid-template-columns: auto minmax(5em, 1fr) 2.6em; }
[data-demo="${NAME}"] .pp-group { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="${NAME}"] .pp-strip { width: 100%; height: auto; }
[data-demo="${NAME}"] .pp-plots { display: flex; flex-wrap: wrap; gap: 12px; width: 100%; }
[data-demo="${NAME}"] .pp-plots svg { flex: 1 1 380px; min-width: 0; max-width: calc(50% - 6px); height: auto; }
[data-demo="${NAME}"] .pp-plots svg.pp-single { max-width: 900px; flex-basis: 100%; }
[data-demo="${NAME}"] svg text { font-size: 17px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 15.5px; fill: #555; }
[data-demo="${NAME}"] .pp-dis { opacity: .45; }
.reveal [data-demo="${NAME}"] { font-size: 20px; gap: .25em; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 17px; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1.1em; height: 1.1em; }
.reveal [data-demo="${NAME}"] .pp-plots svg.pp-single { max-width: 860px; }
@media (max-width: 760px) { [data-demo="${NAME}"] .pp-plots svg { max-width: 100%; flex-basis: 100%; } }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const snap = (v: number, a: number, b: number, step: number, dflt: number) =>
  Number.isFinite(v) ? clamp(Math.round(v / step) * step, a, b) : dflt;
const f2 = (v: number): string => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) : "–");
const fu = (v: number): string => String(+v.toFixed(2));            // 0.5, 1, 2.5
const pct = (f: number): string => `${Math.round(100 * f)}%`;
const on = (s: string | undefined) => s === "on" || s === "1" || s === "true";

function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

/** Text with coloured parts: [text, colour or ""][] */
function rich(svg: SVGElement, x: number, y: number, parts: [string, string][], cls = ""): void {
  const t = svgEl("text", cls ? { x, y, class: cls } : { x, y }, svg);
  for (const [s, c] of parts) {
    const sp = svgEl("tspan", {}, t);
    sp.textContent = s;
    if (c) { sp.style.fill = c; sp.style.fontWeight = "600"; }
  }
}

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const unit = (ds.unit ?? "Mb").trim() || "Mb";
  const genome = unit === "Mb" || unit === "kb";
  const seed0 = Number(ds.seed ?? 1) || 1;
  const view0 = ds.view === "counts" || ds.view === "gaps" ? ds.view : "both";
  const st = {
    rate: snap(Number(ds.rate ?? 2), 0.5, 10, 0.5, 2),
    w: snap(Number(ds.window ?? 1), 0.5, 5, 0.5, 1),
    s: snap(Number(ds.wait ?? 0.5), 0, 3, 0.1, 0.5),
    view: view0 as "counts" | "gaps" | "both",
    memo: on(ds.memoryless),
    clumped: on(ds.clumped),
    seed: seed0,
  };
  let pos: Float64Array = new Float64Array(0), gp: number[] = [], cnt: number[] = [];
  const resim = () => { pos = simulate(st.rate, L, st.clumped, st.seed); gp = gaps(pos, L); cnt = windowCounts(pos, L, st.w); };
  const showC = () => st.view !== "gaps", showG = () => st.view !== "counts";

  // ---------------- controls ----------------
  const row1 = htmlEl("div", "pp-row", "", host);
  slider(row1, `rate (per ${unit})`, 0.5, 10, 0.5, st.rate, v => { st.rate = v; resim(); draw(); }, fu);
  const sW = slider(row1, `window (${unit})`, 0.5, 5, 0.5, st.w, v => { st.w = v; cnt = windowCounts(pos, L, st.w); draw(); }, fu);
  const gv = htmlEl("div", "pp-group", "", row1);
  htmlEl("span", "", "view:", gv);
  const vBtns = presets(gv, (["counts", "gaps", "both"] as const).map(v => ({ label: v, apply: () => { st.view = v; draw(); } })));
  vBtns[["counts", "gaps", "both"].indexOf(st.view)].classList.add("active");
  button(row1, "draw again", () => { st.seed++; resim(); draw(); });

  const row2 = htmlEl("div", "pp-row", "", host);
  const gm = htmlEl("div", "pp-group", "", row2);
  checkbox(gm, "memoryless", st.memo, v => { st.memo = v; draw(); });
  const sS = slider(gm, "already waited", 0, 3, 0.1, st.s, v => { st.s = v; draw(); }, v => fu(v));
  const gc = htmlEl("div", "pp-group", "", row2);
  checkbox(gc, "clumped", st.clumped, v => { st.clumped = v; resim(); draw(); });
  htmlEl("span", "qb-note", "(events in bursts: variance > mean, see negative binomial)", gc);

  const strip = svgEl("svg", { class: "pp-strip", role: "img", "aria-label": "events along the line" }, host);
  const plots = htmlEl("div", "pp-plots", "", host);
  const svgC = svgEl("svg", { role: "img", "aria-label": "histogram of events per window" }, plots);
  const svgG = svgEl("svg", { role: "img", "aria-label": "histogram of gaps between events" }, plots);

  // Widths in SVG units: follow the host so text stays readable on a phone.
  const hostW = () => host.clientWidth || 1100;
  const stripW = () => clamp(Math.round(hostW()), 560, 1200);
  const plotW = () => (st.view === "both" ? 560 : clamp(Math.round(hostW()), 560, 900));

  // ---------------- strip ----------------
  function drawStrip(): void {
    const SW = stripW(), SH = showG() ? 112 : 100;
    const span = SW >= 900 ? 10 : 5;
    strip.setAttribute("viewBox", `0 0 ${SW} ${SH}`);
    strip.replaceChildren();
    const x0 = 14, x1 = SW - 14, x = scale(0, span, x0, x1), yL = 62;
    const nShow = pos.filter(p => p < span).length;
    {
      const tail = SW >= 900 ? ` (rate ${fu(st.rate)} × ${L} ${unit} = ${Math.round(st.rate * L)} expected)` : ` (${Math.round(st.rate * L)} expected)`;
      rich(strip, x0, 18, [[`first ${span} of ${L} ${unit}: ${nShow} events here, ${pos.length} in all${tail}`, ""]], "sm");
    }
    if (showC()) {
      const nw = Math.ceil(span / st.w - 1e-9);
      for (let i = 0; i < nw; i++) {
        const a = x(i * st.w), b = x(Math.min(span, (i + 1) * st.w));
        svgEl("rect", { x: a, width: b - a, y: yL - 22, height: 44, fill: i % 2 ? "var(--qb-panel)" : "var(--qb-grid)", "fill-opacity": i % 2 ? 1 : 0.7 }, strip);
        svgEl("line", { x1: a, x2: a, y1: yL - 24, y2: yL + 22, stroke: "var(--qb-muted)", "stroke-width": 1 }, strip);
        if ((i + 1) * st.w <= span + 1e-9 && b - a >= 18) {
          const t = svgEl("text", { x: (a + b) / 2, y: yL - 26, "text-anchor": "middle", "font-weight": 600 }, strip);
          t.style.fill = COL.bar; t.textContent = String(cnt[i] ?? "");
        }
      }
    }
    svgEl("line", { x1: x0, x2: x1, y1: yL, y2: yL, class: "axis" }, strip);
    if (showG()) {
      const ev = Array.from(pos.filter(p => p < span));
      for (let i = 1; i < ev.length; i++)
        svgEl("rect", { x: x(ev[i - 1]), width: Math.max(0.5, x(ev[i]) - x(ev[i - 1])), y: yL + 22, height: 6,
          fill: i % 2 ? COL.gapA : COL.gapB, "fill-opacity": 0.8 }, strip);
    }
    const ticks = svgEl("g", { stroke: COL.ev, "stroke-width": 2 }, strip);
    for (const p of pos) { if (p >= span) break; svgEl("line", { x1: x(p), x2: x(p), y1: yL - 14, y2: yL + 14 }, ticks); }
    const step = 1;
    for (let v = 0; v <= span + 1e-9; v += step)
      svgEl("text", { x: x(v), y: SH - 6, "text-anchor": v === 0 ? "start" : v >= span - 1e-9 ? "end" : "middle", class: "sm" }, strip)
        .textContent = v >= span - 1e-9 ? `${fu(v)} ${unit}` : fu(v);
  }

  // ---------------- counts ----------------
  function drawCounts(): void {
    const W = plotW(), H = 360, pL = 56, pR = W - 12, pT = 92, pB = H - 46;
    svgC.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svgC.classList.toggle("pp-single", st.view !== "both");
    svgC.replaceChildren();
    const lam = st.rate * st.w, n = cnt.length;
    const { mean, variance } = meanVar(cnt);
    const ratio = variance / mean;
    svgEl("text", { x: 8, y: 22, class: "ttl" }, svgC).textContent = `Counts: ${n} windows of ${fu(st.w)} ${unit}`;
    const verdict: [string, string] = ratio < 1.2 && ratio > 0.83 ? ["  — about equal", COL.bar]
      : ratio >= 1.2 ? [`  — ${f2(ratio)}× the mean: overdispersed`, COL.exp] : [`  — ${f2(ratio)}× the mean`, ""];
    rich(svgC, 8, 48, [[`mean ${f2(mean)}, variance ${f2(variance)}`, ""], verdict]);
    // legend
    svgEl("rect", { x: 8, y: 60, width: 15, height: 15, fill: COL.bar, "fill-opacity": 0.6 }, svgC);
    svgEl("text", { x: 28, y: 73, class: "sm" }, svgC).textContent = "windows";
    svgEl("circle", { cx: 110, cy: 67.5, r: 5.5, fill: COL.exp }, svgC);
    svgEl("text", { x: 120, y: 73, class: "sm" }, svgC).textContent =
      st.clumped ? `Poisson with the same mean (${f2(lam)})` : `Poisson expected (mean ${f2(lam)} = ${fu(st.rate)} × ${fu(st.w)})`;

    let K = Math.max(quantile(k => poisPmf(k, lam), 0.999, 5000), 4);
    const sorted = [...cnt].sort((a, b) => a - b);
    K = Math.max(K, sorted[Math.floor(0.995 * (n - 1))] ?? 0);
    const bin = K + 1 <= 40 ? 1 : Math.ceil((K + 1) / 40);
    const nb = Math.ceil((K + 1) / bin), kTop = nb * bin - 1;
    const hS = new Array<number>(nb).fill(0), hP = new Array<number>(nb).fill(0);
    let beyond = 0;
    for (const c of cnt) { const b = Math.floor(c / bin); if (b < nb) hS[b] += 100 / n; else beyond++; }
    for (let k = 0; k <= kTop; k++) hP[Math.floor(k / bin)] += 100 * poisPmf(k, lam);
    const ymax = Math.max(...hS, ...hP);
    const ys = niceStep(ymax / 4), top = Math.max(ys, Math.ceil(ymax / ys) * ys);
    const x = scale(0, nb, pL, pR), y = scale(0, top, pB, pT);
    for (let v = 0; v <= top + 1e-9; v += ys) {
      svgEl("line", { x1: pL, x2: pR, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svgC);
      svgEl("text", { x: pL - 6, y: y(v) + 5, "text-anchor": "end", class: "sm" }, svgC).textContent = `${+v.toFixed(1)}%`;
    }
    const bw = (pR - pL) / nb, gapPx = bw > 8 ? bw * 0.1 : 0;
    for (let b = 0; b < nb; b++)
      if (hS[b] > 0) svgEl("rect", { x: x(b) + gapPx, width: bw - 2 * gapPx, y: y(hS[b]), height: pB - y(hS[b]), fill: COL.bar, "fill-opacity": 0.6 }, svgC);
    const r = clamp(bw * 0.3, 2.5, 5.5);
    for (let b = 0; b < nb; b++) svgEl("circle", { cx: x(b + 0.5), cy: y(hP[b]), r, fill: COL.exp }, svgC);
    const lstep = Math.max(1, niceStep(nb / 8));
    for (let b = 0; b < nb; b += lstep)
      svgEl("text", { x: x(b + 0.5), y: pB + 19, "text-anchor": "middle", class: "sm" }, svgC).textContent = String(b * bin);
    svgEl("text", { x: (pL + pR) / 2, y: H - 6, "text-anchor": "middle" }, svgC).textContent =
      bin > 1 ? `events in a window (bars of ${bin})` : "events in a window";
    if (beyond) svgEl("text", { x: pR, y: pT + 14, "text-anchor": "end", class: "sm" }, svgC).textContent = `${beyond} windows above ${kTop}`;
  }

  // ---------------- gaps ----------------
  function drawGaps(): void {
    const W = plotW(), H = 360, pL = 56, pR = W - 12, pT = 92, pB = H - 46;
    svgG.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svgG.classList.toggle("pp-single", st.view !== "both");
    svgG.replaceChildren();
    const rate = st.rate, memo = st.memo, s = st.s;
    const all = meanVar(gp).mean, mg = 1 / rate;
    const rem = memo ? gp.filter(g => g > s).map(g => g - s) : gp;
    const rm = meanVar(rem).mean;
    if (!memo) {
      svgEl("text", { x: 8, y: 22, class: "ttl" }, svgG).textContent = `Gaps: ${gp.length} distances between neighbours`;
      rich(svgG, 8, 48, [[`mean gap ${f2(all)} ${unit}`, ""], [` ≈ 1 / rate (1 / ${fu(rate)} = ${f2(mg)})`, COL.bar]]);
    } else {
      svgEl("text", { x: 8, y: 22, class: "ttl" }, svgG).textContent = `Already waited ${fu(s)} ${unit}: what is left?`;
      if (rem.length < 20) {
        rich(svgG, 8, 48, [[`only ${rem.length} of ${gp.length} gaps are longer than ${fu(s)}: wait less`, COL.exp]]);
      } else {
        const same = Math.abs(rm / all - 1) < 0.15;
        rich(svgG, 8, 48, [[`${pct(rem.length / gp.length)} of gaps > ${fu(s)}; left: mean ${f2(rm)}`, ""],
          same ? [` — same as all (${f2(all)})`, COL.bar] : [` — not ${f2(all)}: it remembers`, COL.exp]]);
      }
    }
    // legend
    let lx = 8;
    svgEl("rect", { x: lx, y: 60, width: 15, height: 15, fill: memo ? COL.rem : COL.bar, "fill-opacity": 0.6 }, svgG);
    svgEl("text", { x: lx + 20, y: 73, class: "sm" }, svgG).textContent = memo ? "wait left" : "gaps";
    lx += memo ? 100 : 66;
    if (memo) {
      svgEl("rect", { x: lx, y: 60, width: 15, height: 15, fill: "none", stroke: COL.all, "stroke-width": 2 }, svgG);
      svgEl("text", { x: lx + 20, y: 73, class: "sm" }, svgG).textContent = "all gaps";
      lx += 92;
    }
    svgEl("line", { x1: lx, x2: lx + 22, y1: 67.5, y2: 67.5, stroke: COL.exp, "stroke-width": 3 }, svgG);
    svgEl("text", { x: lx + 28, y: 73, class: "sm" }, svgG).textContent = "expected (exponential)";

    const NB = 20, xmax = 4 / rate, bwU = xmax / NB;
    const hist = (v: number[]) => {
      const h = new Array<number>(NB).fill(0);
      let out = 0;
      for (const g of v) { const b = Math.floor(g / bwU); if (b < NB) h[b] += 100 / v.length; else out++; }
      return { h, out };
    };
    const A = hist(gp), R = memo ? hist(rem) : A;
    // expected % of gaps in a bar of width bwU centred on t (passes through the bar tops)
    const curve = (t: number) => 100 * (Math.exp(-rate * (t - bwU / 2)) - Math.exp(-rate * (t + bwU / 2)));
    const ymax = Math.max(...A.h, ...(memo && rem.length >= 20 ? R.h : []), curve(bwU / 2));
    const ys = niceStep(ymax / 4), top = Math.max(ys, Math.ceil(ymax / ys) * ys);
    const x = scale(0, xmax, pL, pR), y = scale(0, top, pB, pT);
    for (let v = 0; v <= top + 1e-9; v += ys) {
      svgEl("line", { x1: pL, x2: pR, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svgG);
      svgEl("text", { x: pL - 6, y: y(v) + 5, "text-anchor": "end", class: "sm" }, svgG).textContent = `${+v.toFixed(1)}%`;
    }
    const bw = (pR - pL) / NB, g = bw * 0.08;
    if (!memo || rem.length >= 20)
      for (let b = 0; b < NB; b++) {
        const h = R.h[b];
        if (h > 0) svgEl("rect", { x: x(b * bwU) + g, width: bw - 2 * g, y: y(Math.min(h, top)), height: pB - y(Math.min(h, top)),
          fill: memo ? COL.rem : COL.bar, "fill-opacity": 0.6 }, svgG);
      }
    if (memo) {
      let d = `M${x(0)},${pB}`;
      for (let b = 0; b < NB; b++) d += `V${y(A.h[b]).toFixed(1)}H${x((b + 1) * bwU).toFixed(1)}`;
      svgEl("path", { d: d + `V${pB}`, fill: "none", stroke: COL.all, "stroke-width": 2 }, svgG);
    }
    let d = "";
    for (let i = 0; i <= 120; i++) { const t = bwU / 2 + (xmax - bwU) * i / 120; d += `${i ? "L" : "M"}${x(t).toFixed(1)},${y(curve(t)).toFixed(1)}`; }
    svgEl("path", { d, fill: "none", stroke: COL.exp, "stroke-width": 3 }, svgG);
    // mean-gap marker
    svgEl("line", { x1: x(mg), x2: x(mg), y1: pT, y2: pB, stroke: "var(--qb-muted)", "stroke-width": 1.3, "stroke-dasharray": "5 4" }, svgG);
    svgEl("text", { x: x(mg) + 5, y: pT - 4, class: "sm" }, svgG).textContent = `1 / rate = ${f2(mg)}`;
    const xs = niceStep(xmax / 5);
    for (let v = 0; v <= xmax + 1e-9; v += xs)
      svgEl("text", { x: x(v), y: pB + 19, "text-anchor": "middle", class: "sm" }, svgG).textContent = fu(v);
    svgEl("text", { x: (pL + pR) / 2, y: H - 6, "text-anchor": "middle" }, svgG).textContent =
      memo ? `wait left after ${fu(s)} (${unit})` : genome ? `distance to the next event (${unit})` : `waiting time to the next event (${unit})`;
    const out = (memo ? R : A).out;
    if (out) svgEl("text", { x: pR, y: pT + 14, "text-anchor": "end", class: "sm" }, svgG).textContent = `${out} longer than ${f2(xmax)} not shown`;
  }

  function draw(): void {
    vBtns.forEach((b, i) => b.classList.toggle("active", ["counts", "gaps", "both"][i] === st.view));
    row2.querySelector<HTMLElement>(".pp-group")!.style.display = showG() ? "" : "none";
    sS.input.disabled = !st.memo;
    sW.input.disabled = !showC();
    sW.input.closest("label")!.classList.toggle("pp-dis", !showC());
    sS.input.closest("label")!.classList.toggle("pp-dis", !st.memo);
    svgC.style.display = showC() ? "" : "none";
    svgG.style.display = showG() ? "" : "none";
    drawStrip();
    if (showC()) drawCounts();
    if (showG()) drawGaps();
  }

  resim();
  draw();
  let lastW = hostW();
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(() => { const w = hostW(); if (Math.abs(w - lastW) > 20) { lastW = w; draw(); } }).observe(host);
}

autoMount(NAME, mount);
