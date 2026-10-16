// MCMC playground: random-walk Metropolis on the 2D posterior of intercept and slope
// in the age-expression regression. Auto-mounts on <div data-demo="mcmc">.
// Shows the chains as paths on the posterior contours, a trace plot per parameter with the
// warm-up shaded, and histograms of the post-warm-up draws next to the exact posterior.
// Optional attributes: data-step (proposal step size), data-iter (iterations per chain,
// half of them warm-up), data-chains (1-4), data-seed.
import { svgEl, htmlEl, slider, button, presets, scale, rng, autoMount, svgPoint, draggable } from "../lib/ui";
import { exactPosterior, makeLogPost, newChain, metropolisStep, splitRhat, Chain } from "./model";

const CSS = `
[data-demo="mcmc"] { gap: .4em; }
[data-demo="mcmc"] .mc-svg { flex: 1 1 100%; width: 100%; }
[data-demo="mcmc"] .mc-controls { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: .35em 1.4em; align-items: center; }
[data-demo="mcmc"] .mc-controls .qb-slider { flex: 1 1 230px; }
[data-demo="mcmc"] .mc-btns { display: flex; gap: .35em; flex-wrap: wrap; align-items: center; }
[data-demo="mcmc"] .mc-run { min-width: 5.2em; font-weight: 600; }
[data-demo="mcmc"] .mc-readout { flex: 1 1 100%; font-family: ui-monospace, monospace; font-size: .9em;
  background: var(--qb-panel); border-radius: 6px; padding: .3em .6em; }
[data-demo="mcmc"] .mc-good { color: #1a7f37; font-weight: 600; }
[data-demo="mcmc"] .mc-mid { color: #b35900; font-weight: 600; }
[data-demo="mcmc"] .mc-bad { color: #c62828; font-weight: 600; }
.reveal [data-demo="mcmc"] { font-size: 19px; }
.reveal [data-demo="mcmc"] .qb-plot, .reveal [data-demo="mcmc"] .mc-svg { max-width: none; }
`;

function injectCss(): void {
  if (document.getElementById("mc-css")) return;
  const s = document.createElement("style");
  s.id = "mc-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const COLORS = ["var(--qb-c1)", "var(--qb-c2)", "var(--qb-c3)", "var(--qb-c5)"];
const DEFAULT_STARTS: [number, number][] = [[4.2, 2.0], [8.3, 2.0], [4.2, -1.4], [8.3, -1.4]];
let mountCount = 0;
const A_RANGE: [number, number] = [3.5, 9.0];
const B_RANGE: [number, number] = [-2.0, 2.5];

function mount(host: HTMLElement): void {
  injectCss();
  const num = (v: string | undefined, d: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
  const init = {
    logStep: Math.log10(num(host.dataset.step, 0.4)),
    iter: num(host.dataset.iter, 1000),
    nChains: Math.max(1, Math.min(4, num(host.dataset.chains, 4))),
  };
  const seed = num(host.dataset.seed, 11);
  const st = { ...init };
  const starts = DEFAULT_STARTS.map(p => [...p] as [number, number]);
  const exact = exactPosterior();
  const logPost = makeLogPost();
  let chains: Chain[] = [];
  let rngs: ReturnType<typeof rng>[] = [];
  let running = false;

  // ---------------- SVG layout ----------------
  const W = 1150, H = 405;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "mc-svg", role: "img",
    "aria-label": "Metropolis sampler on a 2D posterior with trace plots" });
  // contour panel
  const cx = scale(A_RANGE[0], A_RANGE[1], 80, 480), cy = scale(B_RANGE[0], B_RANGE[1], 355, 15);
  // trace panels
  const TX0 = 600, TX1 = 985, HX0 = 995, HX1 = 1140;
  const rowA = { top: 15, bot: 170 }, rowB = { top: 200, bot: 355 };
  const ta = scale(A_RANGE[0], A_RANGE[1], rowA.bot, rowA.top);
  const tb = scale(B_RANGE[0], B_RANGE[1], rowB.bot, rowB.top);

  const text = (x: number, y: number, s: string, attrs: Record<string, string | number> = {}, parent: Element = svg) => {
    const t = svgEl("text", { x, y, "font-size": 20, ...attrs }, parent);
    t.textContent = s;
    return t;
  };

  // contour panel frame, grid, ticks
  const gC = svgEl("g", {}, svg);
  for (let a = 4; a <= 9; a++) {
    svgEl("line", { x1: cx(a), x2: cx(a), y1: cy(B_RANGE[0]), y2: cy(B_RANGE[1]), class: "grid" }, gC);
    text(cx(a), 380, String(a), { "text-anchor": "middle" }, gC);
  }
  for (let b = -2; b <= 2; b++) {
    svgEl("line", { x1: cx(A_RANGE[0]), x2: cx(A_RANGE[1]), y1: cy(b), y2: cy(b), class: b === 0 ? "axis" : "grid" }, gC);
    text(72, cy(b) + 7, String(b), { "text-anchor": "end" }, gC);
  }
  svgEl("rect", { x: 80, y: 15, width: 400, height: 340, fill: "none", class: "axis" }, gC);
  text(280, 402, "a: expression at age 50", { "text-anchor": "middle" }, gC);
  text(24, 185, "b: change per 10 years", { "text-anchor": "middle", transform: "rotate(-90 24 185)" }, gC);

  // exact posterior contours (1, 2, 3 standard-deviation ellipses)
  const l11 = Math.sqrt(exact.saa), l21 = exact.sab / l11, l22 = Math.sqrt(exact.sbb - l21 * l21);
  for (const [r, op] of [[3, 0.10], [2, 0.16], [1, 0.24]] as [number, number][]) {
    const pts: string[] = [];
    for (let i = 0; i <= 72; i++) {
      const t = 2 * Math.PI * i / 72, u = r * Math.cos(t), v = r * Math.sin(t);
      pts.push(`${cx(exact.ma + l11 * u).toFixed(1)},${cy(exact.mb + l21 * u + l22 * v).toFixed(1)}`);
    }
    svgEl("polygon", { points: pts.join(" "), fill: "var(--qb-c4)", "fill-opacity": op, stroke: "var(--qb-c4)", "stroke-opacity": 0.6 }, gC);
  }
  text(cx(exact.ma), cy(exact.mb) - 3 * Math.sqrt(exact.sbb) * 75 - 8, "posterior", { "text-anchor": "middle", "font-size": 18, fill: "#b35900" }, gC);

  // trace panels
  const gT = svgEl("g", {}, svg);
  const warmA = svgEl("rect", { x: TX0, y: rowA.top, height: rowA.bot - rowA.top, fill: "#000", "fill-opacity": 0.07 }, gT);
  const warmB = svgEl("rect", { x: TX0, y: rowB.top, height: rowB.bot - rowB.top, fill: "#000", "fill-opacity": 0.07 }, gT);
  const warmLabel = text(TX0 + 6, rowA.top + 22, "warm-up (discarded)", { "font-size": 18, fill: "var(--qb-muted)" }, gT);
  for (const [row, s, ticks, name] of [[rowA, ta, [4, 6, 8], "a"], [rowB, tb, [-2, 0, 2], "b"]] as
    [typeof rowA, (v: number) => number, number[], string][]) {
    for (const v of ticks) {
      svgEl("line", { x1: TX0, x2: TX1, y1: s(v), y2: s(v), class: "grid" }, gT);
      text(TX0 - 6, s(v) + 7, String(v), { "text-anchor": "end" }, gT);
    }
    svgEl("rect", { x: TX0, y: row.top, width: TX1 - TX0, height: row.bot - row.top, fill: "none", class: "axis" }, gT);
    svgEl("rect", { x: HX0, y: row.top, width: HX1 - HX0, height: row.bot - row.top, fill: "none", class: "grid" }, gT);
    text(TX0 - 42, (row.top + row.bot) / 2 + 8, name, { "text-anchor": "middle", "font-size": 24, "font-style": "italic" }, gT);
  }
  const iterLabelR = text(TX1, 380, "", { "text-anchor": "end" }, gT);
  text(TX0, 380, "0", { "text-anchor": "start" }, gT);
  text((TX0 + TX1) / 2, 402, "iteration", { "text-anchor": "middle" }, gT);
  text((HX0 + HX1) / 2, 380, "histogram", { "text-anchor": "middle", "font-size": 18 }, gT);
  text((HX0 + HX1) / 2, 402, "after warm-up", { "text-anchor": "middle", "font-size": 18 }, gT);

  // histogram layers
  const NB = 28;
  const mkHist = (row: typeof rowA) => {
    const g = svgEl("g", {}, svg);
    const bars = Array.from({ length: NB }, () => svgEl("rect", { x: HX0, height: 0, width: 0, fill: "var(--qb-accent)", "fill-opacity": 0.55 }, g));
    const curve = svgEl("path", { fill: "none", stroke: "#b35900", "stroke-width": 2.5 }, g);
    const empty = svgEl("g", {}, g);
    text((HX0 + HX1) / 2, (row.top + row.bot) / 2 - 4, "fills after", { "text-anchor": "middle", "font-size": 17, fill: "var(--qb-muted)" }, empty);
    text((HX0 + HX1) / 2, (row.top + row.bot) / 2 + 18, "warm-up", { "text-anchor": "middle", "font-size": 17, fill: "var(--qb-muted)" }, empty);
    return { bars, curve, empty };
  };
  const histA = mkHist(rowA), histB = mkHist(rowB);

  // chain layers: path on contour plot (warm-up lighter), traces, current point, start handle
  const clipId = "mc-clip-" + (++mountCount);
  const clip = svgEl("clipPath", { id: clipId }, svgEl("defs", {}, svg));
  svgEl("rect", { x: 80, y: 15, width: 400, height: 340 }, clip);
  const gPaths = svgEl("g", { "clip-path": `url(#${clipId})` }, svg);
  const gTraces = svgEl("g", {}, svg);
  const gMarks = svgEl("g", {}, svg);
  const layers = COLORS.map((col, j) => ({
    warm: svgEl("polyline", { fill: "none", stroke: col, "stroke-width": 1.5, "stroke-opacity": 0.45 }, gPaths),
    keep: svgEl("polyline", { fill: "none", stroke: col, "stroke-width": 1.5, "stroke-opacity": 0.9 }, gPaths),
    trA: svgEl("polyline", { fill: "none", stroke: col, "stroke-width": 1.4, "stroke-opacity": 0.85 }, gTraces),
    trB: svgEl("polyline", { fill: "none", stroke: col, "stroke-width": 1.4, "stroke-opacity": 0.85 }, gTraces),
    rej: svgEl("line", { stroke: col, "stroke-width": 2, "stroke-dasharray": "5 4" }, gMarks),
    rejX: svgEl("text", { "font-size": 26, "text-anchor": "middle", fill: "#c62828", "font-weight": 700 }, gMarks),
    cur: svgEl("circle", { r: 7, fill: col, stroke: "#fff", "stroke-width": 2 }, gMarks),
    start: svgEl("circle", { r: 14, fill: "#fff", "fill-opacity": 0.6, stroke: col, "stroke-width": 4, class: "handle" }, gMarks),
    j,
  }));
  layers.forEach(L => { L.rejX.textContent = "×"; L.rejX.style.fill = "#c62828"; });

  // drag start points (resets the run)
  layers.forEach((L, j) => {
    draggable(L.start, ev => svgPoint(svg, ev), (px, py) => {
      const a = Math.min(A_RANGE[1], Math.max(A_RANGE[0], cx.invert(px)));
      const b = Math.min(B_RANGE[1], Math.max(B_RANGE[0], cy.invert(py)));
      starts[j] = [a, b];
      reset();
    });
  });

  // ---------------- controls ----------------
  const ctr = htmlEl("div", "mc-controls");
  const btns = htmlEl("div", "mc-btns", "", ctr);
  const runBtn = button(btns, "Run", () => (running ? pause() : run()), "mc-run");
  button(btns, "Step", () => { pause(); advance(1); draw(); });
  button(btns, "Reset", () => { pause(); reset(); });
  const fmtStep = (v: number) => { const s = 10 ** v; return s < 0.1 ? s.toFixed(2) : s < 1 ? s.toFixed(2) : s.toFixed(1); };
  const sStep = slider(ctr, "step size", -2, 0.5, 0.05, st.logStep, v => { st.logStep = v; pause(); reset(); }, fmtStep);
  const sIter = slider(ctr, "iterations", 200, 2000, 100, st.iter, v => { st.iter = v; pause(); reset(); });
  const sCh = slider(ctr, "chains", 1, 4, 1, st.nChains, v => { st.nChains = v; pause(); reset(); });
  const pset = (logStep: number, iter: number) => () => {
    st.logStep = logStep; st.iter = iter; st.nChains = 4;
    sStep.set(logStep); sIter.set(iter); sCh.set(4);
    for (let j = 0; j < 4; j++) starts[j] = [...DEFAULT_STARTS[j]] as [number, number];
    pause(); reset();
  };
  presets(ctr, [
    { label: "tiny steps (0.02)", apply: pset(Math.log10(0.02), 1000) },
    { label: "good steps (0.4)", apply: pset(Math.log10(0.4), 1000) },
    { label: "huge steps (3)", apply: pset(Math.log10(3), 1000) },
  ]);
  const readout = htmlEl("div", "mc-readout", "", ctr);
  host.append(svg, ctr);

  // ---------------- sampler control ----------------
  function reset(): void {
    chains = []; rngs = [];
    for (let j = 0; j < st.nChains; j++) {
      chains.push(newChain(starts[j][0], starts[j][1], logPost));
      rngs.push(rng(seed + 7919 * j));
    }
    draw();
  }
  function iterDone(): number { return chains.length ? chains[0].a.length - 1 : 0; }
  function advance(k: number): void {
    const step = 10 ** st.logStep;
    const todo = Math.min(k, st.iter - iterDone());
    for (let i = 0; i < todo; i++) chains.forEach((c, j) => metropolisStep(c, step, logPost, rngs[j]));
  }
  function frame(): void {
    if (!running) return;
    advance(Math.max(1, Math.round(st.iter / 330)));
    draw();
    if (iterDone() >= st.iter) { pause(); return; }
    requestAnimationFrame(frame);
  }
  function run(): void {
    if (iterDone() >= st.iter) reset();
    running = true; runBtn.textContent = "Pause";
    requestAnimationFrame(frame);
  }
  function pause(): void { running = false; runBtn.textContent = iterDone() >= st.iter ? "Run again" : "Run"; }

  // ---------------- drawing ----------------
  const tx = () => scale(0, st.iter, TX0, TX1);
  const f1 = (v: number) => v.toFixed(1);

  function drawHist(h: typeof histA, draws: number[], row: typeof rowA, s: (v: number) => number,
    lo: number, hi: number, mean: number, sd: number): void {
    const n = draws.length;
    h.empty.style.display = n ? "none" : "";
    h.curve.style.display = n ? "" : "none";
    const bw = (hi - lo) / NB;
    const counts = new Array(NB).fill(0);
    for (const v of draws) { const i = Math.floor((v - lo) / bw); if (i >= 0 && i < NB) counts[i]++; }
    const dens = (v: number) => n * bw * Math.exp(-0.5 * ((v - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
    const top = Math.max(1, dens(mean), ...counts);
    const len = (c: number) => (HX1 - HX0 - 6) * c / top;
    counts.forEach((c, i) => {
      const y0 = s(lo + (i + 1) * bw), y1 = s(lo + i * bw);
      Object.entries({ y: y0 + 0.5, height: Math.max(0, y1 - y0 - 1), width: len(c) })
        .forEach(([k, v]) => h.bars[i].setAttribute(k, String(v)));
    });
    const pts: string[] = [];
    for (let i = 0; i <= 80; i++) {
      const v = lo + (hi - lo) * i / 80;
      pts.push(`${i ? "L" : "M"}${f1(HX0 + len(dens(v)))},${f1(s(v))}`);
    }
    h.curve.setAttribute("d", pts.join(""));
    void row;
  }

  function draw(): void {
    const it = iterDone(), warm = Math.floor(st.iter / 2);
    const X = tx();
    for (const r of [warmA, warmB]) r.setAttribute("width", String(X(warm) - TX0));
    warmLabel.setAttribute("x", String(TX0 + 6));
    iterLabelR.textContent = String(st.iter);
    const thin = Math.max(1, Math.floor(st.iter / 700));
    layers.forEach((L, j) => {
      const c = chains[j];
      const vis = !!c;
      for (const e of [L.warm, L.keep, L.trA, L.trB, L.cur, L.start, L.rej, L.rejX]) e.style.display = vis ? "" : "none";
      if (!c) return;
      const nW = Math.min(c.a.length, warm + 1);
      const pathPts = (from: number, to: number) => {
        const out: string[] = [];
        for (let i = from; i < to; i++) out.push(`${f1(cx(c.a[i]))},${f1(cy(c.b[i]))}`);
        return out.join(" ");
      };
      L.warm.setAttribute("points", pathPts(0, nW));
      L.keep.setAttribute("points", c.a.length > warm ? pathPts(warm, c.a.length) : "");
      const trA: string[] = [], trB: string[] = [];
      for (let i = 0; i < c.a.length; i += (i + thin < c.a.length ? thin : Math.max(1, c.a.length - 1 - i))) {
        trA.push(`${f1(X(i))},${f1(ta(clamp(c.a[i], A_RANGE)))}`);
        trB.push(`${f1(X(i))},${f1(tb(clamp(c.b[i], B_RANGE)))}`);
        if (i === c.a.length - 1) break;
      }
      L.trA.setAttribute("points", trA.join(" "));
      L.trB.setAttribute("points", trB.join(" "));
      const last = c.a.length - 1;
      L.cur.setAttribute("cx", f1(cx(c.a[last]))); L.cur.setAttribute("cy", f1(cy(c.b[last])));
      L.start.setAttribute("cx", f1(cx(starts[j][0]))); L.start.setAttribute("cy", f1(cy(starts[j][1])));
      // last rejected proposal, only while paused (so single steps can be explained)
      const showRej = !running && it > 0 && c.lastProp !== null && !c.lastAcc;
      L.rej.style.display = showRej ? "" : "none";
      L.rejX.style.display = showRej ? "" : "none";
      if (showRej && c.lastProp) {
        const [pa, pb] = c.lastProp;
        const px = cx(clamp(pa, A_RANGE)), py = cy(clamp(pb, B_RANGE));
        Object.entries({ x1: cx(c.a[last]), y1: cy(c.b[last]), x2: px, y2: py })
          .forEach(([k, v]) => L.rej.setAttribute(k, f1(v)));
        L.rejX.setAttribute("x", f1(px)); L.rejX.setAttribute("y", f1(py + 9));
      }
    });

    // post-warm-up draws, pooled
    const keepA = chains.map(c => c.a.slice(warm + 1)), keepB = chains.map(c => c.b.slice(warm + 1));
    drawHist(histA, keepA.flat(), rowA, ta, A_RANGE[0], A_RANGE[1], exact.ma, Math.sqrt(exact.saa));
    drawHist(histB, keepB.flat(), rowB, tb, B_RANGE[0], B_RANGE[1], exact.mb, Math.sqrt(exact.sbb));

    // readout
    const acc = chains.reduce((s, c) => s + c.accepted, 0), prop = chains.reduce((s, c) => s + c.proposed, 0);
    const rA = splitRhat(keepA), rB = splitRhat(keepB);
    readout.innerHTML = "";
    const phase = it === 0 ? "" : it <= warm ? " (warm-up)" : it < st.iter ? " (sampling)" : " (done)";
    readout.append(`iteration ${it} / ${st.iter}${phase}   ·   acceptance ${prop ? Math.round(100 * acc / prop) + "%" : "–"}   ·   R-hat  a `);
    rhatSpan(rA); readout.append("  b "); rhatSpan(rB);
    if (Number.isFinite(rA) && Number.isFinite(rB)) {
      const worst = Math.max(rA, rB);
      htmlEl("span", worst < 1.01 ? "mc-good" : worst < 1.1 ? "mc-mid" : "mc-bad",
        worst < 1.01 ? "   chains agree" : worst < 1.1 ? "   almost" : "   chains disagree", readout);
    }
  }
  function rhatSpan(r: number): void {
    if (!Number.isFinite(r)) { readout.append("–"); return; }
    htmlEl("span", r < 1.01 ? "mc-good" : r < 1.1 ? "mc-mid" : "mc-bad", r > 9.99 ? ">10" : r.toFixed(2), readout);
  }

  reset();
}

function clamp(v: number, [lo, hi]: [number, number]): number { return Math.min(hi, Math.max(lo, v)); }

autoMount("mcmc", mount);
