// UMAP, live: watch the optimiser move every cell. Left: PCA (a fixed linear map, PC1 vs PC2).
// Right: the UMAP layout, re-drawn while SGD pulls kNN neighbours together and pushes random
// pairs apart. There is no formula from high-D to 2D: each cell's (x, y) is a free parameter.
//
// <div data-demo="umaplive"
//      data-preset="clusters"      clusters | trajectory | noise   (first dataset shown)
//      data-k="15"                 n_neighbors (3-50)
//      data-mindist="0.1"          min_dist (0-0.99)
//      data-init="random"          random | spectral
//      data-seed="1"></div>
import { autoMount, button, checkbox, htmlEl, presets, slider, svgEl, svgPoint, setAttrs } from "../lib/ui";
import { Umap, pcaNd, type PcaNd } from "./umap";
import { DATASETS, type Dataset } from "./data";

const N_EPOCHS = 500;
const EPOCHS_PER_FRAME = 2;
const GROUP_COL = ["var(--qb-c1)", "var(--qb-c2)", "var(--qb-c3)", "var(--qb-c4)", "var(--qb-c5)"];
const NOISE_COL = "#6a7f99";
const VIRIDIS = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

const CSS = `
[data-demo="umaplive"].qb-demo { flex-wrap: wrap; gap: 14px; align-items: flex-start; }
[data-demo="umaplive"] .uml-left { flex: 0 0 330px; width: 330px; display: flex; flex-direction: column; gap: 6px; }
[data-demo="umaplive"] .uml-right { flex: 1 1 260px; min-width: 200px; max-width: 340px; display: flex; flex-direction: column; gap: 8px; }
[data-demo="umaplive"] .uml-main { order: 3; flex: 0 0 100%; width: 100%; max-width: 600px; min-width: 0; }
.reveal [data-demo="umaplive"].qb-demo { flex-wrap: nowrap; margin: 0; }
.reveal [data-demo="umaplive"] .uml-main { order: 0; flex: 0 1 540px; width: 540px; max-width: 540px; }
.reveal [data-demo="umaplive"] .uml-right { flex: 1 1 240px; max-width: 300px; }
[data-demo="umaplive"] .uml-row { display: flex; flex-wrap: wrap; gap: .3em; align-items: center; }
[data-demo="umaplive"] .uml-lab { font-size: 18px; color: var(--qb-muted); }
[data-demo="umaplive"] .qb-btn { font-size: 18px; padding: .18em .55em; }
[data-demo="umaplive"] .uml-play { min-width: 4.4em; }
[data-demo="umaplive"] .qb-slider { grid-template-columns: 1fr 3.2em; gap: 0 .4em; font-size: 18px; }
[data-demo="umaplive"] .qb-slider .qb-slider-name { grid-column: 1 / -1; }
[data-demo="umaplive"] .qb-check { font-size: 18px; }
[data-demo="umaplive"] .uml-legend { font-size: 18px; line-height: 1.3; }
[data-demo="umaplive"] .uml-legend .sw { display: inline-block; width: 13px; height: 13px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
[data-demo="umaplive"] .uml-legend .bar { display: inline-block; width: 120px; height: 13px; border-radius: 3px; vertical-align: -1px; margin: 0 6px;
  background: linear-gradient(to right, ${VIRIDIS.join(",")}); }
[data-demo="umaplive"] .qb-note { font-size: 18px; }
[data-demo="umaplive"] svg .ttl { font-size: 20px; font-weight: 600; }
[data-demo="umaplive"] svg .sub { font-size: 18px; fill: var(--qb-muted); }
[data-demo="umaplive"] svg .frame { fill: none; stroke: var(--qb-grid); stroke-width: 1.5; }
[data-demo="umaplive"] svg .springs { fill: none; stroke: #8a94a3; stroke-opacity: .28; stroke-width: 1; }
[data-demo="umaplive"] svg .sel-lines { fill: none; stroke: var(--qb-fg); stroke-opacity: .7; stroke-width: 1.6; }
[data-demo="umaplive"] svg .pt { stroke: #fff; stroke-width: .8; }
[data-demo="umaplive"] svg .pt.dim { opacity: .18; }
[data-demo="umaplive"] svg .pt.nb { stroke: var(--qb-fg); stroke-width: 1.6; }
[data-demo="umaplive"] svg .pt.me { stroke: var(--qb-fg); stroke-width: 3; }
@media (max-width: 700px) {
  [data-demo="umaplive"] .uml-left { flex: 1 1 100%; width: auto; max-width: 400px; }
  [data-demo="umaplive"] .uml-right { max-width: none; }
}
`;

function injectCss(): void {
  if (document.getElementById("uml-style")) return;
  const s = document.createElement("style");
  s.id = "uml-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

function hex(c: string): number[] { return [1, 3, 5].map(p => parseInt(c.slice(p, p + 2), 16)); }
function viridis(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1), q = Math.min(VIRIDIS.length - 2, Math.floor(x)), f = x - q;
  const a = hex(VIRIDIS[q]), b = hex(VIRIDIS[q + 1]);
  return `rgb(${a.map((v, p) => Math.round(v + f * (b[p] - v))).join(",")})`;
}

/** A square scatter panel that fits the data box into [x0, x0+S]×[y0, y0+S] with equal aspect. */
class Panel {
  g: SVGGElement; springs: SVGPathElement; sel: SVGPathElement; gPts: SVGGElement;
  pts: SVGCircleElement[] = [];
  px: Float64Array = new Float64Array(0);
  constructor(public svg: SVGSVGElement, public x0: number, public y0: number, public S: number, public r: number) {
    this.g = svgEl("g", {}, svg);
    this.springs = svgEl("path", { class: "springs" }, this.g);
    this.sel = svgEl("path", { class: "sel-lines" }, this.g);
    this.gPts = svgEl("g", {}, this.g);
  }
  setN(n: number, fill: (i: number) => string): void {
    this.gPts.replaceChildren();
    this.pts = [];
    for (let i = 0; i < n; i++) {
      const c = svgEl("circle", { r: this.r, class: "pt" }, this.gPts);
      c.style.fill = fill(i);
      this.pts.push(c);
    }
    this.px = new Float64Array(2 * n);
  }
  /** Place points; y is a flat [x0, y0, x1, y1, ...] array in data units. */
  place(y: ArrayLike<number>): void {
    const n = y.length / 2;
    let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity;
    for (let i = 0; i < n; i++) {
      lx = Math.min(lx, y[2 * i]); hx = Math.max(hx, y[2 * i]);
      ly = Math.min(ly, y[2 * i + 1]); hy = Math.max(hy, y[2 * i + 1]);
    }
    const pad = this.r + 6, span = Math.max(hx - lx, hy - ly) || 1;
    const s = (this.S - 2 * pad) / span;
    const cx = this.x0 + this.S / 2, cy = this.y0 + this.S / 2, mx = (lx + hx) / 2, my = (ly + hy) / 2;
    for (let i = 0; i < n; i++) {
      const X = cx + (y[2 * i] - mx) * s, Y = cy - (y[2 * i + 1] - my) * s;
      this.px[2 * i] = X; this.px[2 * i + 1] = Y;
      setAttrs(this.pts[i], { cx: X.toFixed(1), cy: Y.toFixed(1) });
    }
  }
  /** One <path> of straight segments between point pairs. */
  segs(path: SVGPathElement, I: ArrayLike<number>, J: ArrayLike<number>): void {
    const p = this.px, parts: string[] = [];
    for (let e = 0; e < I.length; e++) {
      const a = I[e], b = J[e];
      parts.push(`M${p[2 * a].toFixed(1)} ${p[2 * a + 1].toFixed(1)}L${p[2 * b].toFixed(1)} ${p[2 * b + 1].toFixed(1)}`);
    }
    path.setAttribute("d", parts.join(""));
  }
  nearest(x: number, y: number, maxPx: number): number {
    let best = -1, bd = maxPx * maxPx;
    for (let i = 0; i < this.pts.length; i++) {
      const d = (this.px[2 * i] - x) ** 2 + (this.px[2 * i + 1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
}

function mount(host: HTMLElement): void {
  injectCss();
  const keys = Object.keys(DATASETS) as (keyof typeof DATASETS)[];
  let dsKey: keyof typeof DATASETS = keys.includes(host.dataset.preset as keyof typeof DATASETS) ? host.dataset.preset as keyof typeof DATASETS : "clusters";
  let k = Math.round(Math.min(50, Math.max(3, Number(host.dataset.k ?? 15) || 15)));
  let minDist = Math.min(0.99, Math.max(0, Number(host.dataset.mindist ?? 0.1)));
  if (!Number.isFinite(minDist)) minDist = 0.1;
  let init: "random" | "spectral" = host.dataset.init === "spectral" ? "spectral" : "random";
  const seed0 = Math.max(1, Math.round(Number(host.dataset.seed ?? 1) || 1));
  let seed = seed0;
  let showSprings = false;
  let selected = -1;

  let ds: Dataset;
  let pca: PcaNd;
  let um: Umap;
  const cache = new Map<string, { ds: Dataset; pca: PcaNd }>();

  // ---- DOM ----
  const left = htmlEl("div", "uml-left", "", host);
  const pSvg = svgEl("svg", { viewBox: "0 0 330 330", role: "img", "aria-label": "PCA scores, PC1 against PC2" }, left);
  svgEl("rect", { x: 1, y: 1, width: 328, height: 328, rx: 6, class: "frame" }, pSvg);
  const pTitle = svgEl("text", { x: 10, y: 24, class: "ttl" }, pSvg);
  pTitle.textContent = "PCA: a linear map";
  const pAx = svgEl("text", { x: 10, y: 320, class: "sub" }, pSvg);
  const pcaPanel = new Panel(pSvg, 30, 34, 270, 3.6);
  const legend = htmlEl("div", "uml-legend", "", left);
  htmlEl("div", "qb-note", "PCA is one fixed matrix: a new cell can be projected too. UMAP has no such formula.", left);
  htmlEl("div", "qb-note", "Click a cell to mark its k nearest neighbours in high-D.", left);

  const uSvg = svgEl("svg", { viewBox: "0 0 540 540", class: "uml-main", role: "img", "aria-label": "UMAP layout during optimisation" }, host);
  svgEl("rect", { x: 1, y: 1, width: 538, height: 538, rx: 6, class: "frame" }, uSvg);
  const umPanel = new Panel(uSvg, 35, 38, 470, 4.6);
  const uTitle = svgEl("text", { x: 12, y: 26, class: "ttl" }, uSvg);
  uTitle.textContent = "UMAP: every cell's position is optimised";
  const uEpoch = svgEl("text", { x: 12, y: 529, class: "sub" }, uSvg);
  const uNote = svgEl("text", { x: 528, y: 529, class: "sub", "text-anchor": "end" }, uSvg);
  uNote.textContent = "axes have no units";

  const right = htmlEl("div", "uml-right", "", host);
  htmlEl("div", "uml-lab", "Data: 300 cells, 20 dims", right);
  const dsBtns = presets(right, keys.map(key => ({ label: DATASETS[key]().label, apply: () => { pause(); loadData(key); } })));
  const r1 = htmlEl("div", "uml-row", "", right);
  const playBtn = button(r1, "Run", () => (timer === null ? play() : pause()), "uml-play");
  button(r1, "+10 epochs", () => { pause(); um.step(10); draw(); });
  button(r1, "Reset", () => { pause(); restart(); });
  const r2 = htmlEl("div", "uml-row", "", right);
  button(r2, "New random start", () => { pause(); seed++; um.opts.seed = seed; restart(); });
  slider(right, "n_neighbors (k)", 3, 50, 1, k, v => {
    k = v; selected = -1;
    const was = timer !== null; pause(); um.setK(k); draw(); if (was) play();
  });
  slider(right, "min_dist", 0, 0.99, 0.01, minDist, v => {
    minDist = v;
    const was = timer !== null; pause(); um.setMinDist(minDist); draw(); if (was) play();
  });
  htmlEl("div", "uml-lab", "Start layout", right);
  const initBtns = presets(right, [
    { label: "random", apply: () => setInit("random") },
    { label: "spectral", apply: () => setInit("spectral") },
  ]);
  initBtns[init === "random" ? 0 : 1].classList.add("active");
  checkbox(right, "show kNN springs", false, v => { showSprings = v; draw(); });

  function setInit(v: "random" | "spectral"): void { init = v; um.opts.init = v; pause(); restart(); }

  // ---- selection by click (nearest point within 14 px, either panel) ----
  for (const [svg, panel] of [[pSvg, pcaPanel], [uSvg, umPanel]] as const) {
    svg.addEventListener("click", ev => {
      const [x, y] = svgPoint(svg, ev);
      selected = panel.nearest(x, y, 14);
      draw();
    });
  }

  // ---- data / restart ----
  function loadData(key: keyof typeof DATASETS): void {
    dsKey = key;
    if (!cache.has(key)) { const d = DATASETS[key](); cache.set(key, { ds: d, pca: pcaNd(d.X) }); }
    ({ ds, pca } = cache.get(key)!);
    dsBtns.forEach((b, q) => b.classList.toggle("active", keys[q] === key));
    selected = -1;
    seed = seed0;
    um = new Umap(ds.X, { k, minDist, nEpochs: N_EPOCHS, init, seed });
    const fill = (i: number) => ds.time ? viridis(ds.time[i]) : ds.group ? GROUP_COL[ds.group[i] % 5] : NOISE_COL;
    pcaPanel.setN(ds.X.length, fill);
    umPanel.setN(ds.X.length, fill);
    const flat = new Float64Array(2 * ds.X.length);
    pca.scores.forEach(([a, b], i) => { flat[2 * i] = a; flat[2 * i + 1] = b; });
    pcaPanel.place(flat);
    pAx.textContent = `PC1 (${Math.round(100 * pca.varFrac[0])}%) → , PC2 (${Math.round(100 * pca.varFrac[1])}%) ↑`;
    legend.replaceChildren();
    if (ds.time) {
      const row = htmlEl("div", "", "", legend);
      row.append("pseudotime 0");
      htmlEl("span", "bar", "", row);
      row.append("1");
      htmlEl("div", "", "a path that splits into two branches", legend);
    } else {
      ds.legend.forEach((t, q) => {
        const row = htmlEl("div", "", "", legend);
        const sw = htmlEl("span", "sw", "", row);
        sw.style.background = ds.group ? GROUP_COL[q] : NOISE_COL;
        row.append(t);
      });
    }
    draw();
  }

  function restart(): void { um.restart(); draw(); }

  // ---- drawing ----
  function draw(): void {
    umPanel.place(um.y);
    const G = um.graph;
    if (showSprings) umPanel.segs(umPanel.springs, G.i, G.j); else umPanel.springs.setAttribute("d", "");
    uEpoch.textContent = `epoch ${um.epochCount} / ${N_EPOCHS}   ·   seed ${seed}`;
    // selection
    const nb = new Set<number>();
    if (selected >= 0) for (let m = 0; m < um.knn.k; m++) nb.add(um.knn.idx[selected * um.knn.k + m]);
    for (const P of [pcaPanel, umPanel]) {
      P.pts.forEach((c, i) => {
        c.classList.toggle("dim", selected >= 0 && i !== selected && !nb.has(i));
        c.classList.toggle("nb", nb.has(i));
        c.classList.toggle("me", i === selected);
        c.setAttribute("r", String(i === selected ? P.r * 1.8 : P.r));
      });
      if (selected >= 0) {
        const I = [...nb].map(() => selected), J = [...nb];
        P.segs(P.sel, I, J);
        P.gPts.appendChild(P.pts[selected]);          // on top
      } else P.sel.setAttribute("d", "");
    }
    playBtn.disabled = um.done;
    if (um.done) { playBtn.textContent = "Done"; playBtn.classList.remove("active"); }
    else if (timer === null) playBtn.textContent = "Run";
  }

  // ---- animation ----
  let timer: number | null = null;
  let token = 0;
  function frame(tok: number): void {
    if (tok !== token || timer === null) return;
    if (!host.isConnected) { pause(); return; }
    um.step(EPOCHS_PER_FRAME);
    draw();
    if (um.done) { pause(); return; }
    timer = requestAnimationFrame(() => frame(tok));
  }
  function play(): void {
    if (um.done || timer !== null) return;
    const tok = ++token;
    timer = requestAnimationFrame(() => frame(tok));
    playBtn.textContent = "Pause";
    playBtn.classList.add("active");
  }
  function pause(): void {
    if (timer !== null) cancelAnimationFrame(timer);
    timer = null; token++;
    playBtn.classList.remove("active");
    playBtn.textContent = um && um.done ? "Done" : "Run";
  }

  loadData(dsKey);
  // for scripted screenshots and tests: run to the end synchronously
  (host as HTMLElement & { umapRunAll?: () => void }).umapRunAll = () => { pause(); um.step(N_EPOCHS); draw(); };
}

autoMount("umaplive", mount);
