// Variational autoencoder: one latent point z gives MANY samples. Two tabs, both with fixed,
// pre-trained weights (no training in the browser).
//
// "Cells": a tiny VAE trained on 1500 simulated cells × 36 genes (data.ts, train.ts). Left: the
//   2D latent space with the encoder means of the training cells, coloured by type, and a
//   draggable z. Right: the decoder's expected count per gene at z, and 8 cells sampled from
//   the negative binomial around it. Modes: Generate, Walk (z1 → z2), Encode a cell.
// "Digits": a 2D VAE trained on MNIST (train_mnist.py, int8 weights). Draw a digit, encode it,
//   drag z to decode, sample from the encoder cloud, walk between two points.
//
// <div data-demo="vaegen"
//      data-tabs="cells digits"   which tabs to offer (first one is shown first)
//      data-seed="1"></div>
import { autoMount, button, checkbox, htmlEl, presets, rng, scale, slider, svgEl, svgPoint, setAttrs, draggable } from "../lib/ui";
import { rnb } from "../nbdisp/stats";
import { makeCells, LABELS, SETS, GENES_PER_SET, N_GENES } from "./data";
import { encode, decode } from "./vae";
import { VAE_WEIGHTS } from "./weights";
import { MNIST_POINTS } from "./mnist_weights";
import { digitDecode, digitEncode, preprocess } from "./digits";

const TYPE_COL = ["#1f77b4", "#d62728", "#7fbf3f", "#2ca02c", "#9467bd"];
const SET_COL = ["#1f77b4", "#d62728", "#7fbf3f", "#2ca02c", "#9467bd", "#7f7f7f"];
const DIGIT_COL = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
const L_CELLS = 3.6;      // cell latent plot shows [-L, L]²
const L_DIGITS = 4.2;     // digit latent plot
const LS = 440;           // latent plot size (px)
const N_SAMPLES = 8;
const WALK_STEPS = 7;
const YMAX = 50;          // bar chart top (counts)

const CSS = `
[data-demo="vaegen"].qb-demo { display: block; }
[data-demo="vaegen"] .vg-tabs { display: flex; gap: .4em; margin-bottom: 8px; }
[data-demo="vaegen"] .vg-tabs .qb-btn { font-size: 18px; padding: .2em .9em; }
[data-demo="vaegen"] .vg-pane { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
[data-demo="vaegen"] .vg-left { flex: 0 0 ${LS}px; width: ${LS}px; max-width: 100%; }
[data-demo="vaegen"] .vg-right { flex: 1 1 520px; max-width: 660px; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
[data-demo="vaegen"] .vg-row { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="vaegen"] .vg-lab { font-size: 18px; color: var(--qb-muted); }
[data-demo="vaegen"] .qb-btn { font-size: 18px; padding: .16em .55em; }
[data-demo="vaegen"] .qb-slider { font-size: 18px; flex: 1 1 260px; grid-template-columns: auto 1fr 2.6em; }
[data-demo="vaegen"] .qb-check { font-size: 18px; }
[data-demo="vaegen"] .qb-note { font-size: 18px; min-height: 1.3em; }
[data-demo="vaegen"] svg text { font-size: 18px; }
[data-demo="vaegen"] svg .ttl { font-weight: 600; }
[data-demo="vaegen"] svg .mut { fill: var(--qb-muted); }
[data-demo="vaegen"] svg .frame { fill: none; stroke: var(--qb-grid); stroke-width: 1.5; }
[data-demo="vaegen"] svg .halo { stroke: #fff; stroke-width: 4; paint-order: stroke; stroke-linejoin: round; }
[data-demo="vaegen"] .vg-fade { transition: opacity .25s; }
[data-demo="vaegen"] .vg-imgs { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
[data-demo="vaegen"] .vg-imgs figure { margin: 0; display: flex; flex-direction: column; gap: 2px; }
[data-demo="vaegen"] .vg-imgs figcaption { font-size: 18px; color: var(--qb-muted); }
[data-demo="vaegen"] canvas.vg-big { width: 196px; height: 196px; border: 1.5px solid var(--qb-grid); border-radius: 6px; image-rendering: pixelated; }
[data-demo="vaegen"] canvas.vg-draw { width: 196px; height: 196px; border: 2px dashed #9aa; border-radius: 6px; touch-action: none; cursor: crosshair; background: #fff; }
[data-demo="vaegen"] canvas.vg-small { width: 84px; height: 84px; border: 1px solid var(--qb-grid); border-radius: 4px; image-rendering: pixelated; }
[data-demo="vaegen"] .vg-strip { display: flex; gap: 6px; }
[data-demo="vaegen"] .vg-strip canvas { width: 66px; height: 66px; border: 1px solid var(--qb-grid); border-radius: 4px; image-rendering: pixelated; }
.reveal [data-demo="vaegen"].qb-demo { margin: 0; }
.reveal [data-demo="vaegen"] .vg-pane { flex-wrap: nowrap; }
`;

function injectCss(): void {
  if (document.getElementById("vg-style")) return;
  const s = document.createElement("style");
  s.id = "vg-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

type V2 = [number, number];
const fmt = (z: V2) => `(${z[0].toFixed(2)}, ${z[1].toFixed(2)})`;
const lerp = (a: V2, b: V2, t: number): V2 => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];

/** The square latent-space plot shared by both tabs: frame, axes, a points layer and an overlay. */
function latentPlot(parent: Element, label: string, L: number) {
  const clampL = (v: number) => Math.max(-L + 0.05, Math.min(L - 0.05, v));
  const svg = svgEl("svg", { viewBox: `0 0 ${LS} ${LS}`, role: "img", "aria-label": label }, parent);
  const sx = scale(-L, L, 8, LS - 8), sy = scale(-L, L, LS - 8, 8);
  svgEl("rect", { x: 1, y: 1, width: LS - 2, height: LS - 2, rx: 6, class: "frame" }, svg);
  svgEl("line", { x1: sx(0), x2: sx(0), y1: 8, y2: LS - 8, class: "grid" }, svg);
  svgEl("line", { y1: sy(0), y2: sy(0), x1: 8, x2: LS - 8, class: "grid" }, svg);
  const under = svgEl("g", {}, svg);
  const pts = svgEl("g", {}, svg);
  const over = svgEl("g", {}, svg);
  const handles = svgEl("g", {}, svg);
  const ax = svgEl("text", { x: 14, y: LS - 14, class: "mut halo" }, svg);
  ax.textContent = "z₁ →";
  const ay = svgEl("text", { x: 14, y: 26, class: "mut halo" }, svg);
  ay.textContent = "↑ z₂";
  const toWorld = (ev: { clientX: number; clientY: number }): V2 => {
    const [x, y] = svgPoint(svg, ev);
    return [clampL(sx.invert(x)), clampL(sy.invert(y))];
  };
  const handle = (fill: string, stroke: string, r: number, text: string) => {
    const g = svgEl("g", {}, handles);
    svgEl("circle", { r: r + 10, fill: "transparent" }, g);       // larger grab area
    svgEl("circle", { r, fill, stroke, "stroke-width": 3.5 }, g);
    const t = svgEl("text", { x: r + 4, y: -r, class: "ttl halo" }, g);
    t.textContent = text;
    return g;
  };
  return { svg, sx, sy, under, pts, over, handles, toWorld, handle, clampL };
}

function place(g: SVGGElement, x: number, y: number): void { g.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`); }

// ============================================================================================
// Tab 1: cells
// ============================================================================================
function mountCells(pane: HTMLElement, seed0: number): void {
  const w = VAE_WEIGHTS;
  const data = makeCells(2026);
  const enc = data.counts.map(x => encode(w, x));
  const size = w.logSize.map(Math.exp);
  const centre = LABELS.map((_, c) => {
    const e = enc.filter((_, i) => data.label[i] === c);
    return [e.reduce((s, q) => s + q.mu[0], 0) / e.length, e.reduce((s, q) => s + q.mu[1], 0) / e.length] as V2;
  });
  const CT = centre[0], CB = centre[1], CS = centre[2], CE = centre[4];

  type Mode = "gen" | "walk" | "enc";
  let mode: Mode = "gen";
  let z: V2 = [...CT];
  let z2: V2 = [...CE];
  let sel = -1;
  let seed = seed0;
  let disp = 1;

  // ---- left: latent space ----
  const left = htmlEl("div", "vg-left", "", pane);
  const lp = latentPlot(left, "Latent space of the cell VAE", L_CELLS);
  for (let i = 0; i < enc.length; i++) {
    svgEl("circle", { cx: lp.sx(enc[i].mu[0]).toFixed(1), cy: lp.sy(enc[i].mu[1]).toFixed(1), r: 2.3,
      fill: TYPE_COL[data.label[i]], "fill-opacity": 0.4 }, lp.pts);
  }
  const leg = svgEl("g", {}, lp.svg);
  LABELS.forEach((lab, c) => {
    svgEl("circle", { cx: 22, cy: 50 + 23 * c, r: 6, fill: TYPE_COL[c] }, leg);
    const t = svgEl("text", { x: 34, y: 56 + 23 * c, class: "halo" }, leg);
    t.textContent = lab;
  });
  const walkLine = svgEl("line", { stroke: "#333", "stroke-width": 2, "stroke-dasharray": "6 4" }, lp.over);
  const walkDots = svgEl("g", {}, lp.over);
  const cloud = svgEl("ellipse", { fill: "#f4a261", "fill-opacity": 0.25, stroke: "#c4621a", "stroke-width": 2.5 }, lp.over);
  const cloudDots = svgEl("g", {}, lp.over);
  const selRing = svgEl("circle", { r: 6, fill: "none", stroke: "#000", "stroke-width": 2.5 }, lp.over);
  const h1 = lp.handle("#fff", "#111", 11, "z");
  const h2 = lp.handle("#fff", "#c4621a", 9, "z′");

  // ---- right: decoded output ----
  const right = htmlEl("div", "vg-right", "", pane);
  const RW = 660, RH = 352, X0 = 100, X1 = 650, BY0 = 44, BY1 = 172, HY0 = 222;
  const gw = (X1 - X0) / N_GENES;
  const svg = svgEl("svg", { viewBox: `0 0 ${RW} ${RH}`, role: "img", "aria-label": "Decoded gene expression" }, right);
  const title = svgEl("text", { x: 4, y: 22, class: "ttl" }, svg);
  const aLab = svgEl("text", { x: 0, y: 0, "text-anchor": "middle", class: "mut", transform: `translate(20 ${(BY0 + BY1) / 2}) rotate(-90)` }, svg);
  const bLab = svgEl("text", { x: 0, y: 0, "text-anchor": "middle", class: "mut", transform: `translate(20 ${HY0 + 62}) rotate(-90)` }, svg);
  SETS.forEach((s, k) => {
    const t = svgEl("text", { x: X0 + (k + 0.5) * GENES_PER_SET * gw, y: BY1 + 22, "text-anchor": "middle", fill: SET_COL[k] }, svg);
    t.textContent = s;
    if (k > 0) svgEl("line", { x1: X0 + k * GENES_PER_SET * gw, x2: X0 + k * GENES_PER_SET * gw, y1: BY0 - 4, y2: RH - 2, stroke: "#ddd" }, svg);
  });
  const ys = scale(0, YMAX, BY1, BY0);
  const axisG = svgEl("g", {}, svg);
  const top = svgEl("g", {}, svg);     // panel (a) content
  const bot = svgEl("g", { class: "vg-fade" }, svg); // panel (b) content
  const note = htmlEl("div", "qb-note", "", right);

  const modeRow = htmlEl("div", "vg-row", "", right);
  htmlEl("span", "vg-lab", "Mode:", modeRow);
  const modeBtns = presets(modeRow, [
    { label: "Generate", apply: () => setMode("gen") },
    { label: "Walk z → z′", apply: () => setMode("walk") },
    { label: "Encode a cell", apply: () => setMode("enc") },
  ]);
  modeBtns[0].classList.add("active");
  const presetRow = htmlEl("div", "vg-row", "", right);
  const row3 = htmlEl("div", "vg-row", "", right);
  button(row3, "Sample again", () => {
    seed++;
    bot.style.opacity = "0.15";
    draw();
    requestAnimationFrame(() => requestAnimationFrame(() => { bot.style.opacity = "1"; }));
  });
  slider(row3, "noise: dispersion ×", 0, 3, 0.5, disp, v => { disp = v; draw(); }, v => v.toFixed(1));

  function setPresets(items: { label: string; apply: () => void }[]): void {
    presetRow.replaceChildren();
    htmlEl("span", "vg-lab", "Presets:", presetRow);
    presets(presetRow, items);
  }
  function setMode(m: Mode): void {
    mode = m;
    if (m === "enc" && sel < 0) selectCell(nearestCell(CS));
    if (m === "gen") setPresets([
      { label: "T centre", apply: () => { z = [...CT]; draw(); } },
      { label: "B centre", apply: () => { z = [...CB]; draw(); } },
      { label: "T–B midway", apply: () => { z = lerp(CT, CB, 0.5); draw(); } },
      { label: "far outside", apply: () => { z = [3.2, -3.2]; draw(); } },
      { label: "Reset", apply: () => { z = [...CT]; disp = 1; seed = seed0; draw(); } },
    ]);
    else if (m === "walk") setPresets([
      { label: "stem → erythroid", apply: () => { z = [...CS]; z2 = [...CE]; draw(); } },
      { label: "T → B", apply: () => { z = [...CT]; z2 = [...CB]; draw(); } },
      { label: "far outside → stem", apply: () => { z = [3.2, -3.2]; z2 = [...CS]; draw(); } },
    ]);
    else setPresets(LABELS.map((lab, c) => ({ label: `a ${lab}`, apply: () => selectCell(nearestCell(centre[c])) })));
    draw();
  }
  function nearestCell(p: V2): number {
    let best = 0, bd = Infinity;
    enc.forEach((e, i) => { const d = (e.mu[0] - p[0]) ** 2 + (e.mu[1] - p[1]) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function selectCell(i: number): void { sel = i; z = [enc[i].mu[0], enc[i].mu[1]]; draw(); }

  // pointer: drag handles; click on the background moves z (or picks a cell in encode mode)
  draggable(h1, lp.toWorld, (x, y) => { z = [x, y]; if (mode === "enc") sel = -1; draw(); });
  draggable(h2, lp.toWorld, (x, y) => { z2 = [x, y]; draw(); });
  lp.svg.addEventListener("click", ev => {
    if (h1.contains(ev.target as Node) || h2.contains(ev.target as Node)) return;
    const p = lp.toWorld(ev);
    if (mode === "enc") selectCell(nearestCell(p));
    else { z = p; draw(); }
  });

  const sample = (m: number[], r: ReturnType<typeof rng>) =>
    m.map((mu, g) => rnb(mu, disp === 0 ? Infinity : size[g] / disp, r.unif));
  const heat = (c: number) => {
    const t = Math.min(1, Math.log1p(c) / Math.log1p(40));
    const a = [255, 255, 255], b = [8, 48, 107];
    return `rgb(${a.map((v, k) => Math.round(v + t * (b[k] - v))).join(",")})`;
  };
  function heatRows(g: SVGGElement, rows: number[][], y0: number, rh: number, labels: string[]): void {
    rows.forEach((row, r) => {
      row.forEach((c, k) => svgEl("rect", { x: (X0 + k * gw).toFixed(1), y: y0 + r * rh, width: (gw + 0.4).toFixed(1), height: rh - 1, fill: heat(c) }, g));
      if (labels[r]) {
        const t = svgEl("text", { x: X0 - 6, y: y0 + r * rh + rh / 2 + 6, "text-anchor": "end" }, g);
        t.textContent = labels[r];
      }
    });
  }
  function bars(g: SVGGElement, m: number[], filled: boolean): void {
    m.forEach((v, k) => {
      const col = SET_COL[Math.floor(k / GENES_PER_SET)];
      const y = ys(Math.min(v, YMAX));
      if (filled) svgEl("rect", { x: (X0 + k * gw + 2).toFixed(1), y: y.toFixed(1), width: (gw - 4).toFixed(1), height: (BY1 - y).toFixed(1), fill: col, "fill-opacity": 0.75 }, g);
      else svgEl("line", { x1: (X0 + k * gw).toFixed(1), x2: (X0 + (k + 1) * gw).toFixed(1), y1: y.toFixed(1), y2: y.toFixed(1), stroke: "#000", "stroke-width": 3 }, g);
    });
  }
  function axis(show: boolean): void {
    axisG.replaceChildren();
    if (!show) return;
    for (const v of [0, 25, 50]) {
      svgEl("line", { x1: X0, x2: X1, y1: ys(v), y2: ys(v), stroke: v ? "#eee" : "#999" }, axisG);
      const t = svgEl("text", { x: X0 - 6, y: ys(v) + 6, "text-anchor": "end", class: "mut" }, axisG);
      t.textContent = String(v);
    }
  }

  function draw(): void {
    const zz = z;
    place(h1, lp.sx(zz[0]), lp.sy(zz[1]));
    h2.style.display = mode === "walk" ? "" : "none";
    walkLine.style.display = mode === "walk" ? "" : "none";
    walkDots.replaceChildren(); cloudDots.replaceChildren();
    cloud.style.display = selRing.style.display = mode === "enc" && sel >= 0 ? "" : "none";
    top.replaceChildren(); bot.replaceChildren();
    const r = rng(seed);
    if (mode === "gen") {
      const m = decode(w, zz);
      const cells = Array.from({ length: N_SAMPLES }, () => sample(m, r));
      title.textContent = `Decoder output at z = ${fmt(zz)}`;
      aLab.textContent = "expected"; bLab.textContent = `${N_SAMPLES} cells`;
      axis(true);
      bars(top, m, true);
      cells.forEach(c => c.forEach((v, k) => svgEl("circle", {
        cx: (X0 + (k + 0.5) * gw + (r.unif() - 0.5) * gw * 0.5).toFixed(1), cy: ys(Math.min(v, YMAX)).toFixed(1), r: 2.6,
        fill: v > YMAX ? "#e00" : "#222", "fill-opacity": 0.55 }, top)));
      heatRows(bot, cells, HY0, 15, []);
      note.textContent = "Bars: expected counts. Dots, rows: 8 cells from the same z.";
    } else if (mode === "walk") {
      place(h2, lp.sx(z2[0]), lp.sy(z2[1]));
      setAttrs(walkLine, { x1: lp.sx(zz[0]), y1: lp.sy(zz[1]), x2: lp.sx(z2[0]), y2: lp.sy(z2[1]) });
      const zs = Array.from({ length: WALK_STEPS }, (_, s) => lerp(zz, z2, s / (WALK_STEPS - 1)));
      zs.forEach(p => svgEl("circle", { cx: lp.sx(p[0]), cy: lp.sy(p[1]), r: 4.5, fill: "#333" }, walkDots));
      const means = zs.map(p => decode(w, p));
      title.textContent = `Walk from z ${fmt(zz)} to z′ ${fmt(z2)}`;
      aLab.textContent = "expected"; bLab.textContent = "sampled";
      axis(false);
      const lab = zs.map((_, s) => (s === 0 ? "z" : s === WALK_STEPS - 1 ? "z′" : ""));
      heatRows(top, means, BY0 + 2, 18, lab);
      heatRows(bot, means.map(m => sample(m, r)), HY0, 18, lab);
      note.textContent = `${WALK_STEPS} equally spaced points on the dashed line, decoded. Dark = high count.`;
    } else {
      if (sel < 0) {
        title.textContent = "Click a training cell in the latent space";
        aLab.textContent = bLab.textContent = ""; axis(false); note.textContent = "";
        return;
      }
      const e = enc[sel], x = Array.from(data.counts[sel]);
      setAttrs(selRing, { cx: lp.sx(e.mu[0]), cy: lp.sy(e.mu[1]) });
      setAttrs(cloud, { cx: lp.sx(e.mu[0]), cy: lp.sy(e.mu[1]),
        rx: (lp.sx(2 * e.sd[0]) - lp.sx(0)).toFixed(1), ry: (lp.sx(2 * e.sd[1]) - lp.sx(0)).toFixed(1) });
      const zs: V2[] = Array.from({ length: 5 }, () => [e.mu[0] + e.sd[0] * r.norm(), e.mu[1] + e.sd[1] * r.norm()]);
      zs.forEach(p => svgEl("circle", { cx: lp.sx(p[0]), cy: lp.sy(p[1]), r: 3.5, fill: "#c4621a" }, cloudDots));
      const rec = decode(w, e.mu);
      title.textContent = `Cell #${sel + 1} (${LABELS[data.label[sel]]}): cloud centre ${fmt(e.mu as V2)}, spread ±${e.sd[0].toFixed(2)}, ±${e.sd[1].toFixed(2)}`;
      aLab.textContent = "measured"; bLab.textContent = "";
      axis(true);
      bars(top, x, true);
      bars(top, rec, false);
      heatRows(bot, [x, rec, ...zs.map(p => decode(w, p))], HY0, 18, ["measured", "decoded", "", "from the", "cloud", "", ""]);
      note.textContent = "Bars: measured counts. Black lines: decoded at the cloud centre. Orange: cloud (±2 sd).";
    }
  }
  setMode("gen");
}

// ============================================================================================
// Tab 2: digits (MNIST)
// ============================================================================================
/** Paint a 28×28 image (0 = white, 1 = black) into a canvas of the same size. */
function paint(cv: HTMLCanvasElement, img: ArrayLike<number>): void {
  const ctx = cv.getContext("2d")!;
  const id = ctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const v = Math.round(255 * (1 - Math.max(0, Math.min(1, img[i]))));
    id.data[4 * i] = id.data[4 * i + 1] = id.data[4 * i + 2] = v; id.data[4 * i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}
function canvas28(parent: Element, cls: string): HTMLCanvasElement {
  const c = htmlEl("canvas", cls, "", parent);
  c.width = 28; c.height = 28;
  return c;
}

function mountDigits(pane: HTMLElement, seed0: number): void {
  const centre: V2[] = Array.from({ length: 10 }, (_, d) => {
    const p = MNIST_POINTS.filter(q => q[2] === d);
    const med = (k: 0 | 1) => p.map(q => q[k]).sort((a, b) => a - b)[Math.floor(p.length / 2)];
    return [med(0), med(1)];
  });
  let z: V2 = [...centre[3]];
  let z2: V2 = [...centre[8]];
  let walk = false, showGrid = false;
  let code: { mu: V2; sd: V2 } | null = null;
  let strip: "none" | "cloud" | "walk" = "none";
  let seed = seed0;

  // ---- left ----
  const left = htmlEl("div", "vg-left", "", pane);
  const lp = latentPlot(left, "Latent space of the digit VAE", L_DIGITS);
  const gridImg = svgEl("image", { x: lp.sx(-4), y: lp.sy(4), width: lp.sx(4) - lp.sx(-4), height: lp.sy(-4) - lp.sy(4), preserveAspectRatio: "none" }, lp.under);
  for (const [a, b, d] of MNIST_POINTS)
    svgEl("circle", { cx: lp.sx(a).toFixed(1), cy: lp.sy(b).toFixed(1), r: 2.2, fill: DIGIT_COL[d], "fill-opacity": 0.45 }, lp.pts);
  centre.forEach((c, d) => {
    const t = svgEl("text", { x: lp.sx(c[0]), y: lp.sy(c[1]) + 8, "text-anchor": "middle", class: "ttl halo", fill: DIGIT_COL[d], style: "font-size:24px" }, lp.pts);
    t.textContent = String(d);
  });
  const walkLine = svgEl("line", { stroke: "#333", "stroke-width": 2, "stroke-dasharray": "6 4" }, lp.over);
  const walkDots = svgEl("g", {}, lp.over);
  const cloud = svgEl("ellipse", { fill: "#f4a261", "fill-opacity": 0.3, stroke: "#c4621a", "stroke-width": 2.5 }, lp.over);
  const codeMark = svgEl("path", { d: "M-8,-8L8,8M-8,8L8,-8", stroke: "#c4621a", "stroke-width": 3.5 }, lp.over);
  const cloudDots = svgEl("g", {}, lp.over);
  const h1 = lp.handle("#fff", "#111", 11, "z");
  const h2 = lp.handle("#fff", "#c4621a", 9, "z′");

  // ---- right ----
  const right = htmlEl("div", "vg-right", "", pane);
  const imgs = htmlEl("div", "vg-imgs", "", right);
  const f1 = htmlEl("figure", "", "", imgs);
  htmlEl("figcaption", "", "draw a digit here", f1);
  const drawCv = htmlEl("canvas", "vg-draw", "", f1);
  const D = 196;
  drawCv.width = D; drawCv.height = D;
  const f2 = htmlEl("figure", "", "", imgs);
  htmlEl("figcaption", "", "decoded from z", f2);
  const bigCv = canvas28(f2, "vg-big");
  const f3 = htmlEl("figure", "", "", imgs);
  htmlEl("figcaption", "", "encoder input", f3);
  const inCv = canvas28(f3, "vg-small");
  const zLab = htmlEl("figcaption", "", "", f3);
  const stripLab = htmlEl("div", "vg-lab", "", right);
  const stripRow = htmlEl("div", "vg-strip", "", right);
  const stripCv = Array.from({ length: WALK_STEPS }, () => canvas28(stripRow, ""));

  const r1 = htmlEl("div", "vg-row", "", right);
  button(r1, "Clear", () => { clearDraw(); code = null; if (strip === "cloud") strip = "none"; draw(); });
  button(r1, "Encode", () => doEncode());
  button(r1, "Sample from the cloud", () => {
    if (!code) { note.textContent = "Draw a digit and press Encode first."; return; }
    seed++; strip = "cloud"; walk = false; walkBox.checked = false; draw();
  });
  const walkBox = checkbox(r1, "walk z → z′", false, v => { walk = v; strip = v ? "walk" : "none"; draw(); });
  const r2 = htmlEl("div", "vg-row", "", right);
  htmlEl("span", "vg-lab", "Presets:", r2);
  presets(r2, [
    { label: "a 1", apply: () => { z = [...centre[1]]; draw(); } },
    { label: "a 7", apply: () => { z = [...centre[7]]; draw(); } },
    { label: "walk 1 → 7", apply: () => { z = [...centre[1]]; z2 = [...centre[7]]; walk = true; walkBox.checked = true; strip = "walk"; draw(); } },
    { label: "far outside", apply: () => { z = [3.3, -3.3]; draw(); } },
    { label: "Reset", apply: () => { z = [...centre[3]]; walk = false; walkBox.checked = false; strip = "none"; code = null; clearDraw(); draw(); } },
  ]);
  checkbox(r2, "decoded grid", false, v => { showGrid = v; draw(); });
  const note = htmlEl("div", "qb-note", "", right);

  // ---- drawing ----
  const dctx = drawCv.getContext("2d")!;
  function clearDraw(): void { dctx.fillStyle = "#fff"; dctx.fillRect(0, 0, D, D); paint(inCv, new Float32Array(784)); zLab.textContent = ""; }
  clearDraw();
  let last: V2 | null = null;
  const pos = (ev: PointerEvent): V2 => {
    const b = drawCv.getBoundingClientRect();
    return [(ev.clientX - b.left) * D / b.width, (ev.clientY - b.top) * D / b.height];
  };
  drawCv.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    try { drawCv.setPointerCapture(ev.pointerId); } catch { /* synthetic events */ }
    last = pos(ev); stroke(last, last);
  });
  drawCv.addEventListener("pointermove", ev => { if (!last) return; const p = pos(ev); stroke(last, p); last = p; });
  const end = () => { last = null; };
  drawCv.addEventListener("pointerup", end);
  drawCv.addEventListener("pointercancel", end);
  function stroke(a: V2, b: V2): void {
    Object.assign(dctx, { strokeStyle: "#000", lineWidth: 22, lineCap: "round", lineJoin: "round", shadowColor: "#000", shadowBlur: 3 });
    dctx.beginPath(); dctx.moveTo(a[0], a[1]); dctx.lineTo(b[0], b[1]); dctx.stroke();
  }
  function doEncode(): void {
    const px = dctx.getImageData(0, 0, D, D).data, ink = new Float32Array(D * D);
    for (let i = 0; i < D * D; i++) ink[i] = 1 - px[4 * i] / 255;
    const img = preprocess(ink, D);
    if (!img) { note.textContent = "Nothing drawn yet: draw a digit in the dashed box first."; return; }
    paint(inCv, img);
    code = digitEncode(img);
    z = [lp.clampL(code.mu[0]), lp.clampL(code.mu[1])];
    zLab.textContent = `→ ${fmt(code.mu)}`;
    strip = walk ? "walk" : "none";
    draw();
  }

  draggable(h1, lp.toWorld, (x, y) => { z = [x, y]; draw(); });
  draggable(h2, lp.toWorld, (x, y) => { z2 = [x, y]; draw(); });
  lp.svg.addEventListener("click", ev => {
    if (h1.contains(ev.target as Node) || h2.contains(ev.target as Node)) return;
    z = lp.toWorld(ev); draw();
  });

  let gridDone = false;
  function renderGrid(): void {
    const n = 16, c = document.createElement("canvas");
    c.width = c.height = 28 * n;
    const ctx = c.getContext("2d")!;
    const tmp = document.createElement("canvas"); tmp.width = tmp.height = 28;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const zz: V2 = [-4 + 8 * (j + 0.5) / n, 4 - 8 * (i + 0.5) / n];
      paint(tmp, digitDecode(zz));
      ctx.drawImage(tmp, 28 * j, 28 * i);
    }
    gridImg.setAttribute("href", c.toDataURL());
    gridDone = true;
  }

  function draw(): void {
    if (showGrid && !gridDone) renderGrid();
    gridImg.style.display = showGrid ? "" : "none";
    lp.pts.style.opacity = showGrid ? "0.25" : "1";
    place(h1, lp.sx(z[0]), lp.sy(z[1]));
    h2.style.display = walkLine.style.display = walk ? "" : "none";
    place(h2, lp.sx(z2[0]), lp.sy(z2[1]));
    setAttrs(walkLine, { x1: lp.sx(z[0]), y1: lp.sy(z[1]), x2: lp.sx(z2[0]), y2: lp.sy(z2[1]) });
    walkDots.replaceChildren(); cloudDots.replaceChildren();
    cloud.style.display = codeMark.style.display = code ? "" : "none";
    if (code) {
      place(codeMark as unknown as SVGGElement, lp.sx(code.mu[0]), lp.sy(code.mu[1]));
      setAttrs(cloud, { cx: lp.sx(code.mu[0]), cy: lp.sy(code.mu[1]),
        rx: Math.max(3, lp.sx(2 * code.sd[0]) - lp.sx(0)).toFixed(1), ry: Math.max(3, lp.sx(2 * code.sd[1]) - lp.sx(0)).toFixed(1) });
    }
    paint(bigCv, digitDecode(z));
    let zs: V2[] = [];
    if (strip === "walk" && walk) {
      zs = Array.from({ length: WALK_STEPS }, (_, s) => lerp(z, z2, s / (WALK_STEPS - 1)));
      zs.forEach(p => svgEl("circle", { cx: lp.sx(p[0]), cy: lp.sy(p[1]), r: 4.5, fill: "#333" }, walkDots));
      stripLab.textContent = `Walk: ${WALK_STEPS} points from z ${fmt(z)} to z′ ${fmt(z2)}, decoded`;
    } else if (strip === "cloud" && code) {
      const r = rng(seed), c = code;
      zs = Array.from({ length: WALK_STEPS }, () => [c.mu[0] + c.sd[0] * r.norm(), c.mu[1] + c.sd[1] * r.norm()] as V2);
      zs.forEach(p => svgEl("circle", { cx: lp.sx(p[0]), cy: lp.sy(p[1]), r: 3, fill: "#c4621a" }, cloudDots));
      stripLab.textContent = `${WALK_STEPS} draws from the encoder's cloud (±${c.sd[0].toFixed(2)}, ±${c.sd[1].toFixed(2)}), decoded`;
    } else stripLab.textContent = "Strip: tick “walk” or press “Sample from the cloud”.";
    stripCv.forEach((cv, k) => paint(cv, zs[k] ? digitDecode(zs[k]) : new Float32Array(784)));
    note.textContent = `z = ${fmt(z)}. Drag z, or click anywhere in the map.`;
  }
  draw();
}

// ============================================================================================
function mount(host: HTMLElement): void {
  injectCss();
  const tabs = (host.dataset.tabs ?? "cells digits").split(/\s+/).filter(t => t === "cells" || t === "digits");
  if (!tabs.length) tabs.push("cells");
  const seed = Math.max(1, Math.round(Number(host.dataset.seed ?? 1) || 1));
  const bar = htmlEl("div", "vg-tabs", "", host);
  const panes = new Map<string, HTMLElement>();
  const show = (t: string) => {
    if (!panes.has(t)) {
      const p = htmlEl("div", "vg-pane", "", host);
      panes.set(t, p);
      if (t === "cells") mountCells(p, seed); else mountDigits(p, seed);
    }
    panes.forEach((p, k) => { p.style.display = k === t ? "" : "none"; });
  };
  if (tabs.length > 1) {
    const btns = presets(bar, tabs.map(t => ({ label: t === "cells" ? "Single cells" : "Digits (MNIST)", apply: () => show(t) })));
    btns[0].classList.add("active");
  } else bar.style.display = "none";
  show(tabs[0]);
}

autoMount("vaegen", mount);
