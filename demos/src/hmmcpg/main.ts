// HMM for CpG islands: generate a DNA sequence from a 2-state HMM (H = GC-rich, L = normal),
// then hide the states and decode them again with Viterbi and with the posterior
// P(z_t = H | x) from forward-backward.
//
// <div data-demo="hmmcpg"
//      data-n="60"          number of bases (60 on a slide, 120 on a page)
//      data-per-row="30"    bases per row of tiles (30 on a slide, 24 on a page)
//      data-seed="8"        first random seed ("New sequence" moves to the next)
//      data-start="all"     "all": start fully generated; "0": start empty, ready to step
//      data-hide="0"></div> "1": start with the states hidden
//
// Any slider change re-simulates with the SAME random numbers (same seed), and the
// decoder always uses the current (true) parameters. So the comparison between two
// settings is fair, and decoding failures come from the data, not from a wrong model.
import { svgEl, htmlEl, button, presets, checkbox, slider, rng, autoMount, Slider } from "../lib/ui";
import { BASES, STATES, Model, makeModel, simulate, forwardBackward, viterbi, agreement } from "./hmm";

const CSS = `
[data-demo="hmmcpg"].qb-demo { display: block; }
[data-demo="hmmcpg"] .qbh-svg { width: 100%; height: auto; display: block; }
[data-demo="hmmcpg"] .qbh-bottom { display: flex; flex-wrap: wrap; gap: .3em 1.4em; align-items: flex-start; margin-top: .2em; }
[data-demo="hmmcpg"] .qbh-col { display: flex; flex-direction: column; gap: .3em; flex: 1 1 420px; min-width: 0; }
[data-demo="hmmcpg"] .qbh-row { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; font-size: 18px; }
[data-demo="hmmcpg"] .qbh-row .qb-presets { display: inline-flex; }
[data-demo="hmmcpg"] .qbh-lab { font-size: 18px; color: var(--qb-muted); margin-right: .1em; }
[data-demo="hmmcpg"] .qb-btn { font-size: 18px; padding: .15em .6em; }
[data-demo="hmmcpg"] .qb-check { font-size: 18px; margin-right: .4em; }
[data-demo="hmmcpg"] .qbh-sliders { display: grid; grid-template-columns: 1fr 1fr; gap: .1em 1.2em; font-size: 18px; }
[data-demo="hmmcpg"] .qb-slider { grid-template-columns: auto 1fr 2.6em; gap: .4em; }
[data-demo="hmmcpg"] .qbh-readout { font-size: 18px; font-variant-numeric: tabular-nums; white-space: pre-wrap;
  background: var(--qb-panel); border-radius: 6px; padding: .3em .55em; line-height: 1.3; min-height: 3.9em; }
[data-demo="hmmcpg"] .qbh-model { font-size: 18px; color: var(--qb-muted); white-space: pre-wrap; font-variant-numeric: tabular-nums; }
[data-demo="hmmcpg"] .qbh-sw { display: inline-block; width: 18px; height: 14px; margin-left: .5em; }
[data-demo="hmmcpg"] .qbh-sw:first-child { margin-left: 0; }
.reveal [data-demo="hmmcpg"].qb-demo { margin: 0; }
`;

function injectCss(): void {
  if (document.getElementById("qbh-style")) return;
  const s = document.createElement("style");
  s.id = "qbh-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

// colours: H band orange, L band grey; C/G tiles dark blue, A/T tiles pale
const COL_H = "var(--qb-c4)", COL_L = "#c4c4c4", COL_HIDDEN = "#ececec";
const TILE_GC = "#2b6cb0", TILE_AT = "#e4ebf3";
const f2 = (v: number) => v.toFixed(2);
const g3 = (v: number) => String(Math.round(v * 1000) / 1000);

interface Params { stayH: number; stayL: number; gcH: number; gcL: number }
const LECTURE: Params = { stayH: 0.8, stayL: 0.7, gcH: 0.8, gcL: 0.4 };
const PRESET_LIST: { label: string; p: Params }[] = [
  { label: "Lecture HMM", p: LECTURE },
  { label: "Realistic CpG", p: { stayH: 0.95, stayL: 0.95, gcH: 0.7, gcL: 0.4 } },
  { label: "Low contrast", p: { stayH: 0.8, stayL: 0.7, gcH: 0.55, gcL: 0.45 } },
  { label: "Not sticky", p: { stayH: 0.55, stayL: 0.5, gcH: 0.8, gcL: 0.4 } },
];

function sci(v: number): string {
  if (v >= 1e-4) return v.toPrecision(3).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const e = Math.floor(Math.log10(v));
  return (v / 10 ** e).toFixed(2) + "e" + e;
}

function mount(host: HTMLElement): void {
  injectCss();
  const N = Math.max(4, Math.min(300, Number(host.dataset.n ?? 60) || 60));
  const perRow = Math.max(5, Math.min(60, Number(host.dataset.perRow ?? 30) || 30));
  const seed0 = Number(host.dataset.seed ?? 8) || 8;
  const startAll = (host.dataset.start ?? "all") !== "0";
  const hide0 = host.dataset.hide === "1";

  // ---- state ----
  let par: Params = { ...LECTURE };
  let seed = seed0;
  let us: number[] = [];
  let model: Model = makeModel(par.stayH, par.stayL, par.gcH, par.gcL);
  let z: number[] = [], x: number[] = [];
  let ns = 0, nb = 0;            // states revealed, bases revealed (nb is ns or ns - 1)
  let hidden = hide0, showVit = false, showPost = false;
  let anim: number | null = null;

  const drawUs = () => { const r = rng(seed); us = Array.from({ length: 2 * N }, () => r.unif()); };
  const resim = () => {
    model = makeModel(par.stayH, par.stayL, par.gcH, par.gcL);
    ({ z, x } = simulate(model, us));
  };

  // ---- DOM ----
  const rows = Math.ceil(N / perRow);
  // a slide is ~1150 px wide; on a page the demo is ~800 px, so use a narrower viewBox there
  const W = host.closest(".reveal") ? 1150 : 820;
  const LW = 112, pitch = (W - LW - 4) / perRow, tile = pitch - 3;
  const PH = 46, SH = 18, TH = 32;
  const yPost = 4, yVit = yPost + PH + 5, yTrue = yVit + SH + 4, yTile = yTrue + SH + 5;
  const RH = yTile + TH + 16;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${rows * RH - 10}`, class: "qbh-svg", role: "img",
    "aria-label": "DNA bases with hidden states, Viterbi path and posterior" }, host);

  const bottom = htmlEl("div", "qbh-bottom", "", host);
  const colL = htmlEl("div", "qbh-col", "", bottom);
  const colR = htmlEl("div", "qbh-col", "", bottom);

  const r1 = htmlEl("div", "qbh-row", "", colL);
  htmlEl("span", "qbh-lab", "Generate:", r1);
  button(r1, "Step", () => { stopAnim(); step(); render(); });
  button(r1, "Generate all", () => generateAll());
  button(r1, "Clear", () => { stopAnim(); ns = nb = 0; render(); });
  button(r1, "New sequence", () => { stopAnim(); seed++; drawUs(); resim(); ns = nb = N; render(); });

  const r2 = htmlEl("div", "qbh-row", "", colL);
  htmlEl("span", "qbh-lab", "Decode:", r2);
  const hideBox = checkbox(r2, "Hide states", hidden, v => { hidden = v; render(); });
  const vitBtn = button(r2, "Viterbi", () => { showVit = !showVit; render(); });
  const postBox = checkbox(r2, "Posterior", showPost, v => { showPost = v; render(); });
  button(r2, "Reveal truth", () => { hidden = false; hideBox.checked = false; render(); });

  const readout = htmlEl("div", "qbh-readout", "", colL);

  const r3 = htmlEl("div", "qbh-row", "", colR);
  htmlEl("span", "qbh-lab", "Model:", r3);
  const presetBtns = presets(r3, [
    ...PRESET_LIST.map(it => ({ label: it.label, apply: () => setParams(it.p) })),
    { label: "Reset", apply: () => reset() },
  ]);
  const sl = htmlEl("div", "qbh-sliders", "", colR);
  const onSlide = () => {
    par = { stayH: sH.get(), stayL: sL.get(), gcH: gH.get(), gcL: gL.get() };
    presetBtns.forEach(b => b.classList.remove("active"));
    resim(); render();
  };
  const sH: Slider = slider(sl, "A(H→H)", 0.5, 0.99, 0.01, par.stayH, onSlide, f2);
  const sL: Slider = slider(sl, "A(L→L)", 0.5, 0.99, 0.01, par.stayL, onSlide, f2);
  const gH: Slider = slider(sl, "GC in H", 0.2, 0.9, 0.05, par.gcH, onSlide, f2);
  const gL: Slider = slider(sl, "GC in L", 0.2, 0.9, 0.05, par.gcL, onSlide, f2);
  const legend = htmlEl("div", "qbh-row", "", colR);
  const sw = (color: string, text: string, round = false) => {
    const b = htmlEl("span", "qbh-sw", "", legend);
    Object.assign(b.style, { background: color, borderRadius: round ? "50%" : "2px" });
    if (round) Object.assign(b.style, { width: "10px", height: "10px" });
    htmlEl("span", "", text, legend);
  };
  sw(COL_H, "H GC-rich"); sw(COL_L, "L normal"); sw(TILE_GC, "C/G"); sw("#222", "Viterbi wrong", true);
  const modelOut = htmlEl("div", "qbh-model", "", colR);

  function setParams(p: Params): void {
    stopAnim();
    par = { ...p };
    sH.set(p.stayH); sL.set(p.stayL); gH.set(p.gcH); gL.set(p.gcL);
    resim(); render();
  }
  function reset(): void {
    stopAnim();
    seed = seed0; drawUs();
    hidden = hide0; hideBox.checked = hidden;
    showVit = false; showPost = false; postBox.checked = false;
    setParams(LECTURE);
    ns = nb = startAll ? N : 0;
    presetBtns.forEach((b, i) => b.classList.toggle("active", i === 0));
    render();
  }

  // ---- generation ----
  function step(): void {
    if (nb < ns) nb++;
    else if (ns < N) ns++;
  }
  function stopAnim(): void {
    if (anim !== null) { cancelAnimationFrame(anim); anim = null; ns = nb = N; }
  }
  function generateAll(): void {
    stopAnim();
    const from = nb, t0 = performance.now(), dur = 900;
    if (from >= N) { ns = nb = N; render(); return; }
    const tick = (now: number) => {
      const k = Math.min(N, from + Math.ceil((N - from) * Math.min(1, (now - t0) / dur)));
      ns = nb = Math.max(k, from);
      render();
      anim = nb < N ? requestAnimationFrame(tick) : null;
    };
    anim = requestAnimationFrame(tick);
  }

  // ---- drawing ----
  function cellX(t: number): number { return LW + (t % perRow) * pitch; }
  function rowY(t: number): number { return Math.floor(t / perRow) * RH; }

  function render(): void {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const xs = x.slice(0, nb);
    const fb = nb > 0 && (showPost || showVit) ? forwardBackward(model, xs) : null;
    const vit = nb > 0 && showVit ? viterbi(model, xs) : null;

    for (let r = 0; r < rows; r++) {
      const y0 = r * RH;
      const lab = (y: number, text: string, dim = false) => svgEl("text", { x: LW - 10, y, "text-anchor": "end",
        "font-size": 18, opacity: dim ? 0.4 : 1 }, svg).textContent = text;
      lab(y0 + yPost + PH / 2 + 6, "P(H | x)", !showPost);
      lab(y0 + yVit + SH - 3, "Viterbi", !showVit);
      lab(y0 + yTrue + SH - 3, hidden ? "z hidden" : "true z");
      lab(y0 + yTile + TH / 2 + 6, "bases x");
      const n0 = r * perRow, n1 = Math.min(N, n0 + perRow);
      const xEnd = LW + (n1 - n0) * pitch - 3;
      // empty strip backgrounds, so the layout is stable
      for (const [yy, hh] of [[yVit, SH], [yTrue, SH]] as const)
        svgEl("rect", { x: LW, y: y0 + yy, width: xEnd - LW, height: hh, fill: "none", stroke: "#ddd" }, svg);
      svgEl("rect", { x: LW, y: y0 + yPost, width: xEnd - LW, height: PH, fill: "none", stroke: "#ddd" }, svg);
      svgEl("line", { x1: LW, x2: xEnd, y1: y0 + yPost + PH / 2, y2: y0 + yPost + PH / 2, stroke: "#999",
        "stroke-dasharray": "4 4", opacity: showPost ? 1 : 0.35 }, svg);
      // posterior area chart
      if (fb && showPost) {
        const m = Math.min(n1, nb);
        if (m > n0) {
          let d = `M${cellX(n0)},${y0 + yPost + PH}`;
          for (let t = n0; t < m; t++) {
            const yy = y0 + yPost + PH * (1 - fb.postH[t]);
            d += ` L${cellX(t)},${yy} L${cellX(t) + pitch - 3},${yy}`;
          }
          d += ` L${cellX(m - 1) + pitch - 3},${y0 + yPost + PH} Z`;
          svgEl("path", { d, fill: COL_H, "fill-opacity": 0.55, stroke: COL_H, "stroke-width": 1.5 }, svg);
        }
      }
    }

    // state strips as runs (one rect per run of equal states within a row)
    const strip = (path: number[], n: number, yy: number, fill: (k: number) => string) => {
      let a = 0;
      for (let t = 1; t <= n; t++) {
        if (t === n || path[t] !== path[a] || t % perRow === 0) {
          svgEl("rect", { x: cellX(a), y: rowY(a) + yy, width: cellX(t - 1) + pitch - 3 - cellX(a), height: SH,
            fill: fill(path[a]) }, svg);
          a = t;
        }
      }
    };
    // hidden: one plain band, so the run boundaries do not give the states away
    if (hidden) strip(new Array<number>(ns).fill(0), ns, yTrue, () => COL_HIDDEN);
    else strip(z, ns, yTrue, k => (k === 0 ? COL_H : COL_L));
    if (vit) strip(vit, nb, yVit, k => (k === 0 ? COL_H : COL_L));

    for (let t = 0; t < N; t++) {
      const cx = cellX(t), y0 = rowY(t);
      if (t < ns && hidden) svgEl("text", { x: cx + tile / 2, y: y0 + yTrue + SH - 3, "text-anchor": "middle", "font-size": 16, fill: "#999" }, svg).textContent = "?";
      if (vit && t < nb && !hidden && vit[t] !== z[t])
        svgEl("circle", { cx: cx + tile / 2, cy: y0 + yVit + SH / 2, r: 4.5, fill: "#222" }, svg);
      // base tile
      const ty = y0 + yTile;
      if (t < nb) {
        const gc = x[t] === 1 || x[t] === 2;
        svgEl("rect", { x: cx, y: ty, width: tile, height: TH, rx: 4, fill: gc ? TILE_GC : TILE_AT }, svg);
        const txt = svgEl("text", { x: cx + tile / 2, y: ty + TH / 2 + 7, "text-anchor": "middle", "font-size": 20,
          "font-weight": 700, "font-family": "ui-monospace, monospace" }, svg);
        txt.style.fill = gc ? "#fff" : "#1d2b3a";
        txt.textContent = BASES[x[t]];
      } else {
        svgEl("rect", { x: cx + 0.5, y: ty + 0.5, width: tile - 1, height: TH - 1, rx: 4, fill: "none", stroke: "#ddd",
          "stroke-dasharray": t === ns - 1 ? "4 3" : "" }, svg);
      }
      // the step just taken
      if (ns < N || nb < N) {
        if (t === ns - 1 && (anim === null))
          svgEl("rect", { x: cx - 2, y: y0 + yTrue - 2, width: tile + 4, height: yTile + TH - yTrue + 4, rx: 5,
            fill: "none", stroke: "#222", "stroke-width": 2 }, svg);
      }
    }

    // ---- readout ----
    vitBtn.classList.toggle("active", showVit);
    const lines: string[] = [];
    const St = (k: number) => STATES[k];
    const sub = (n: number) => String(n).replace(/\d/g, d => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
    if (anim !== null) lines.push(`generating… ${nb} of ${N}`);
    else if (ns === 0) lines.push(`t = 0. Press Step: first z₁ from π, then x₁ from row z₁ of B.`);
    else {
      const t = ns;
      if (nb < ns) {
        lines.push(t === 1 ? `t = 1: z₁ = ${hidden ? "?" : St(z[0])}   (start: π = ${g3(model.pi[z[0]])})`
          : `t = ${t}: z${sub(t)} = ${hidden ? "?" : St(z[t - 1])}   (move ${hidden ? "?" : St(z[t - 2]) + "→" + St(z[t - 1])}: A = ${hidden ? "?" : g3(model.A[z[t - 2]][z[t - 1]])})`);
      } else if (nb < N || t <= 10) {
        lines.push(`t = ${t}: x${sub(t)} = ${BASES[x[t - 1]]}   (emit from ${hidden ? "?" : St(z[t - 1])}: B = ${hidden ? "?" : g3(model.B[z[t - 1]][x[t - 1]])})`);
      } else lines.push(`${N} bases generated (seed ${seed}).`);
      if (!hidden) {
        const fac: number[] = [];
        for (let k = 0; k < ns; k++) {
          fac.push(k === 0 ? model.pi[z[0]] : model.A[z[k - 1]][z[k]]);
          if (k < nb) fac.push(model.B[z[k]][x[k]]);
        }
        const p = fac.reduce((a, b) => a * b, 1);
        lines.push(fac.length <= 8 ? `P(x, z) = ${fac.map(g3).join("×")} = ${sci(p)}`
          : `P(x, z) for the true path = ${sci(p)}`);
      }
    }
    if (fb) lines.push(`log P(x) = ${fb.logLik.toFixed(2)}   (forward, sum over all paths)`);
    if (vit || (fb && showPost)) {
      if (hidden) lines.push("Reveal truth to score the decoding.");
      else {
        const parts: string[] = [];
        if (vit) parts.push(`Viterbi ${Math.round(100 * agreement(vit, z.slice(0, nb)))}%`);
        if (fb && showPost) parts.push(`posterior>0.5 ${Math.round(100 * agreement(fb.postH.map(p => (p > 0.5 ? 0 : 1)), z.slice(0, nb)))}%`);
        lines.push(`correct: ${parts.join(" · ")}`);
      }
    }
    readout.textContent = lines.join("\n");
    const row = (b: number[]) => b.map(g3).join("  ");
    modelOut.textContent = `π = (${row(model.pi)})    A = [${row(model.A[0])} ; ${row(model.A[1])}]\n`
      + `B (A C G T):  row H = ${row(model.B[0])}\n                       row L = ${row(model.B[1])}`;
  }

  drawUs();
  reset();
}

autoMount("hmmcpg", mount);
