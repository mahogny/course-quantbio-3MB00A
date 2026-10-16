// Leiden (or Louvain) clustering of the kNN graph, with the resolution gamma as a slider.
// The clustering runs on the weighted kNN graph (the one UMAP uses, as scanpy does); the 2D
// picture is a UMAP layout computed once per dataset with the umaplive code (k = 15,
// min_dist = 0.5 as in scanpy, random start, seed 1)
// and is used only for drawing.
//
// <div data-demo="leiden"
//      data-preset="clusters"      clusters | trajectory | noise
//      data-k="15"                 n_neighbors (3-50)
//      data-gamma="1"              resolution (0.1-3)
//      data-algo="leiden"          leiden | louvain
//      data-seed="1"></div>
import { autoMount, button, checkbox, htmlEl, presets, slider, svgEl, setAttrs } from "../lib/ui";
import { Umap, knn, fuzzyGraph } from "../umaplive/umap";
import { DATASETS, type Dataset } from "../umaplive/data";
import { Run, cluster, fromEdges, modularity, pieces, contingency, ari, nComm, relabel, type Algo, type WGraph } from "./leiden";

type Key = keyof typeof DATASETS;

const PAL = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b",
  "#e377c2", "#bcbd22", "#17becf", "#393b79", "#ffbb78", "#98df8a"];
const SINGLE = "#c9c9c9";
const G_MIN = -1, G_MAX = 0.48;                     // slider works on log10(gamma); 10^0.48 is capped at 3
const TRUE_NAMES: Record<Key, string[]> = { clusters: ["A", "B", "C", "D"], trajectory: ["stem", "br. 1", "br. 2"], noise: [] };

const CSS = `
[data-demo="leiden"].qb-demo { flex-wrap: wrap; gap: 14px; align-items: flex-start; }
[data-demo="leiden"] .lei-plot { flex: 0 1 540px; width: 540px; max-width: 100%; min-width: 0; }
[data-demo="leiden"] .lei-ctl { flex: 0 0 270px; width: 270px; display: flex; flex-direction: column; gap: 7px; }
[data-demo="leiden"] .lei-out { flex: 1 1 280px; min-width: 240px; max-width: 320px; display: flex; flex-direction: column; gap: 6px; }
.reveal [data-demo="leiden"].qb-demo { flex-wrap: nowrap; margin: 0; }
.reveal [data-demo="leiden"] .lei-out { flex: 0 0 300px; width: 300px; }
[data-demo="leiden"] .lei-row { display: flex; flex-wrap: wrap; gap: .3em; align-items: center; }
[data-demo="leiden"] .lei-lab { font-size: 18px; color: var(--qb-muted); }
[data-demo="leiden"] .qb-btn { font-size: 18px; padding: .16em .5em; }
[data-demo="leiden"] .qb-btn:disabled { opacity: .45; cursor: default; }
[data-demo="leiden"] .qb-slider { grid-template-columns: 1fr 3.2em; gap: 0 .4em; font-size: 18px; }
[data-demo="leiden"] .qb-slider .qb-slider-name { grid-column: 1 / -1; }
[data-demo="leiden"] .qb-check { font-size: 18px; }
[data-demo="leiden"] .qb-note, [data-demo="leiden"] .lei-txt { font-size: 18px; line-height: 1.3; }
[data-demo="leiden"] .lei-big { font-size: 21px; font-weight: 600; white-space: pre; line-height: 1.25; }
[data-demo="leiden"] .lei-bad { color: #c0392b; font-weight: 600; }
[data-demo="leiden"] svg text { font-size: 18px; }
[data-demo="leiden"] svg .ttl { font-size: 20px; font-weight: 600; }
[data-demo="leiden"] svg .sub { fill: var(--qb-muted); }
[data-demo="leiden"] svg .frame { fill: none; stroke: var(--qb-grid); stroke-width: 1.5; }
[data-demo="leiden"] svg .edges { fill: none; stroke: #8a94a3; stroke-opacity: .3; stroke-width: 1; }
[data-demo="leiden"] svg .pt { stroke: #fff; stroke-width: .8; }
[data-demo="leiden"] svg .pt.bad { stroke: #111; stroke-width: 2.2; }
[data-demo="leiden"] svg .faded .pt { opacity: .22; }
[data-demo="leiden"] svg .agg-e { stroke: #555; stroke-opacity: .45; stroke-linecap: round; }
[data-demo="leiden"] svg .agg-n { stroke: #fff; stroke-width: 1.5; }
@media (max-width: 700px) {
  [data-demo="leiden"] .lei-ctl, [data-demo="leiden"] .lei-out { flex: 1 1 100%; width: auto; max-width: none; }
}
`;

function injectCss(): void {
  if (document.getElementById("lei-style")) return;
  const s = document.createElement("style");
  s.id = "lei-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const col = (c: number, size: number) => (size <= 1 ? SINGLE : PAL[c % PAL.length]);

interface Built { k: number; G: WGraph; I: Int32Array; J: Int32Array }
interface Data { ds: Dataset; xy: Float64Array; graphs: Map<number, Built> }

function mount(host: HTMLElement): void {
  injectCss();
  const keys = Object.keys(DATASETS) as Key[];
  const num = (s: string | undefined, d: number, lo: number, hi: number) => { const v = Number(s ?? d); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const def = {
    key: (keys.includes(host.dataset.preset as Key) ? host.dataset.preset : "clusters") as Key,
    k: Math.round(num(host.dataset.k, 15, 3, 50)),
    lg: Math.round(100 * Math.log10(num(host.dataset.gamma, 1, 0.1, 3))) / 100,
    algo: (host.dataset.algo === "louvain" ? "louvain" : "leiden") as Algo,
    seed: Math.max(1, Math.round(num(host.dataset.seed, 1, 1, 1e6))),
  };
  let key = def.key, k = def.k, lg = def.lg, algo = def.algo, seed = def.seed, showEdges = false;
  const gamma = () => Math.min(3, Math.pow(10, lg));
  const cache = new Map<Key, Data>();
  let D: Data | null = null;
  let B: Built | null = null;
  let labels: Int32Array = new Int32Array(0);
  let run: Run | null = null;            // non-null while stepping
  let stepNo = 0, stepMsg = "", refinedView = false;

  // ---- DOM: plot ----
  const svg = svgEl("svg", { viewBox: "0 0 540 540", class: "lei-plot", role: "img", "aria-label": "Cells coloured by cluster, drawn on a UMAP layout" }, host);
  svgEl("rect", { x: 1, y: 1, width: 538, height: 538, rx: 6, class: "frame" }, svg);
  const ttl = svgEl("text", { x: 12, y: 26, class: "ttl" }, svg);
  const sub = svgEl("text", { x: 12, y: 50, class: "sub" }, svg);
  sub.textContent = "clustering runs on the graph; the layout only draws it";
  const edgePath = svgEl("path", { class: "edges" }, svg);
  const gPts = svgEl("g", {}, svg);
  const gAgg = svgEl("g", {}, svg);
  const foot = svgEl("text", { x: 12, y: 528, class: "sub" }, svg);
  let pts: SVGCircleElement[] = [];
  const px = new Float64Array(600);

  // ---- DOM: controls ----
  const ctl = htmlEl("div", "lei-ctl", "", host);
  htmlEl("div", "lei-lab", "Data: 300 cells, 20 dims", ctl);
  const dsBtns = presets(ctl, keys.map(kk => ({ label: DATASETS[kk]().label, apply: () => { key = kk; load(); } })));
  const algoBtns = presets(ctl, [
    { label: "Leiden", apply: () => { algo = "leiden"; recompute(); } },
    { label: "Louvain", apply: () => { algo = "louvain"; recompute(); } },
  ]);
  const gSl = slider(ctl, "resolution γ (log scale)", G_MIN, G_MAX, 0.01, lg, v => { lg = v; schedule(); }, v => Math.min(3, 10 ** v).toFixed(2));
  const kSl = slider(ctl, "n_neighbors (k)", 3, 50, 1, k, v => { k = v; schedule(); });
  const edgeBox = checkbox(ctl, "show graph edges", false, v => { showEdges = v; draw(); });
  const rowS = htmlEl("div", "lei-row", "", ctl);
  button(rowS, "New seed", () => { seed++; recompute(); });
  const seedLab = htmlEl("span", "lei-lab", "", rowS);
  button(rowS, "Reset", () => {
    k = def.k; lg = def.lg; algo = def.algo; seed = def.seed; showEdges = false;
    kSl.set(k); gSl.set(lg); edgeBox.checked = false; recompute();
  });
  htmlEl("div", "lei-lab", "Step through one phase at a time:", ctl);
  const rowP = htmlEl("div", "lei-row", "", ctl);
  const nextBtn = button(rowP, "Next phase", () => stepOnce());
  const endBtn = button(rowP, "Finish", () => { if (run) { while (!run.done) { run.step(); stepNo++; } stepMsg = "finished"; refinedView = false; labels = run.flat(); draw(); } });

  // ---- DOM: readouts ----
  const out = htmlEl("div", "lei-out", "", host);
  const big = htmlEl("div", "lei-big", "", out);
  const sizeLab = htmlEl("div", "lei-txt", "", out);
  const bars = svgEl("svg", { viewBox: "0 0 300 86", width: "100%", role: "img", "aria-label": "cluster sizes" }, out);
  const conn = htmlEl("div", "lei-txt", "", out);
  const agrLab = htmlEl("div", "lei-txt", "", out);
  const heat = svgEl("svg", { viewBox: "0 0 300 100", width: "100%", role: "img", "aria-label": "true group by cluster" }, out);
  const note = htmlEl("div", "qb-note", "", out);

  // ---- data ----
  function data(kk: Key): Data {
    if (!cache.has(kk)) {
      const ds = DATASETS[kk]();
      const um = new Umap(ds.X, { k: 15, minDist: 0.5, nEpochs: 500, init: "random", seed: 1 });
      um.step(500);
      cache.set(kk, { ds, xy: um.y, graphs: new Map() });
    }
    return cache.get(kk)!;
  }
  function graph(d: Data, kk: number): Built {
    if (!d.graphs.has(kk)) {
      const f = fuzzyGraph(knn(d.ds.X, kk));
      d.graphs.set(kk, { k: kk, G: fromEdges(f.n, f.i, f.j, f.w), I: f.i, J: f.j });
    }
    return d.graphs.get(kk)!;
  }

  function load(): void {
    D = data(key);
    dsBtns.forEach((b, q) => b.classList.toggle("active", keys[q] === key));
    gPts.replaceChildren();
    pts = [];
    const n = D.ds.X.length, y = D.xy;
    let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity;
    for (let i = 0; i < n; i++) {
      lx = Math.min(lx, y[2 * i]); hx = Math.max(hx, y[2 * i]); ly = Math.min(ly, y[2 * i + 1]); hy = Math.max(hy, y[2 * i + 1]);
    }
    const S = 436, x0 = 52, y0 = 64, s = (S - 12) / (Math.max(hx - lx, hy - ly) || 1);
    for (let i = 0; i < n; i++) {
      px[2 * i] = x0 + S / 2 + (y[2 * i] - (lx + hx) / 2) * s;
      px[2 * i + 1] = y0 + S / 2 - (y[2 * i + 1] - (ly + hy) / 2) * s;
      pts.push(svgEl("circle", { cx: px[2 * i].toFixed(1), cy: px[2 * i + 1].toFixed(1), r: 4.6, class: "pt" }, gPts));
    }
    recompute();
  }

  /** Leave step mode and cluster with the current settings. */
  function recompute(): void {
    if (!D) return;
    B = graph(D, k);
    run = null; stepNo = 0; refinedView = false;
    labels = cluster(B.G, gamma(), algo, seed);
    draw();
  }
  let pending = false;
  function schedule(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; recompute(); });
  }

  function stepOnce(): void {
    if (!B) return;
    if (!run) {
      run = new Run(B.G, gamma(), algo, seed);
      stepNo = 0; stepMsg = "start: every cell is its own cluster";
      refinedView = false; labels = run.flat();
    } else if (!run.done) {
      const msg = run.step();
      stepNo++;
      refinedView = run.phase === "refine";
      labels = refinedView ? run.flatRefined() : run.flat();
      stepMsg = msg;
    }
    draw();
  }

  // ---- drawing ----
  function draw(): void {
    if (!D || !B) return;
    const n = labels.length, K = nComm(labels);
    const size = new Array(K).fill(0);
    for (let i = 0; i < n; i++) size[labels[i]]++;
    const pc = pieces(B.G, labels);
    const bad = pc.map(p => p > 1);
    algoBtns.forEach((b, q) => b.classList.toggle("active", (q === 0) === (algo === "leiden")));
    seedLab.textContent = `seed ${seed}`;
    ttl.textContent = `${algo === "leiden" ? "Leiden" : "Louvain"} clusters of the kNN graph`;

    // graph edges
    if (showEdges) {
      const parts: string[] = [];
      for (let e = 0; e < B.I.length; e++) {
        const a = B.I[e], b = B.J[e];
        parts.push(`M${px[2 * a].toFixed(1)} ${px[2 * a + 1].toFixed(1)}L${px[2 * b].toFixed(1)} ${px[2 * b + 1].toFixed(1)}`);
      }
      edgePath.setAttribute("d", parts.join(""));
    } else edgePath.setAttribute("d", "");

    // cells
    pts.forEach((c, i) => {
      c.style.fill = col(labels[i], size[labels[i]]);
      c.classList.toggle("bad", bad[labels[i]] && !refinedView);
    });

    // aggregated graph: one big node per node of the current graph, at its cells' centroid
    gAgg.replaceChildren();
    const showAgg = !!run && run.level > 0 && !refinedView && !run.done;
    gPts.classList.toggle("faded", showAgg);
    if (showAgg && run) {
      const G = run.G, cx = new Float64Array(G.n), cy = new Float64Array(G.n), cnt = new Float64Array(G.n);
      for (let i = 0; i < n; i++) { const v = run.cellNode[i]; cx[v] += px[2 * i]; cy[v] += px[2 * i + 1]; cnt[v]++; }
      for (let v = 0; v < G.n; v++) { cx[v] /= cnt[v]; cy[v] /= cnt[v]; }
      let wmax = 0;
      for (let q = 0; q < G.nbr.length; q++) wmax = Math.max(wmax, G.wt[q]);
      for (let v = 0; v < G.n; v++) {
        for (let q = G.off[v]; q < G.off[v + 1]; q++) {
          const u = G.nbr[q];
          if (u <= v) continue;
          svgEl("line", { x1: cx[v].toFixed(1), y1: cy[v].toFixed(1), x2: cx[u].toFixed(1), y2: cy[u].toFixed(1), class: "agg-e",
            "stroke-width": (0.8 + 11 * Math.sqrt(G.wt[q] / wmax)).toFixed(2) }, gAgg);
        }
      }
      const cellLab = run.flat();
      const nodeLab = new Int32Array(G.n);
      for (let i = 0; i < n; i++) nodeLab[run.cellNode[i]] = cellLab[i];
      for (let v = 0; v < G.n; v++) {
        const c = svgEl("circle", { cx: cx[v].toFixed(1), cy: cy[v].toFixed(1), r: (3 + 2 * Math.sqrt(cnt[v])).toFixed(1), class: "agg-n" }, gAgg);
        c.style.fill = col(nodeLab[v], size[nodeLab[v]] ?? 2);
      }
    }

    // footer: step label or settings
    foot.textContent = run ? `step ${stepNo}: ${stepMsg}` : `γ = ${gamma().toFixed(2)}, k = ${k}, seed ${seed}`;
    nextBtn.disabled = !!run && run.done;
    endBtn.disabled = !run || run.done;

    // readouts
    const word = refinedView ? "sub-clusters" : "clusters";
    big.textContent = `${K} ${word}\nmodularity Q = ${modularity(B.G, labels, gamma()).toFixed(3)}`;
    sizeLab.textContent = refinedView ? "Sub-cluster sizes:" : "Cluster sizes:";
    drawBars(size, bad);
    const nBad = bad.filter(x => x).length;
    conn.replaceChildren();
    if (nBad === 0) conn.textContent = `Each ${word.slice(0, -1)} connected in the graph? yes, all ${K}.`;
    else {
      const which = bad.map((x, c) => (x ? `${c + 1} (${pc[c]} pieces)` : "")).filter(Boolean).join(", ");
      htmlEl("span", "lei-bad", `Not connected: ${word.slice(0, -1)} ${which}.`, conn);
      conn.append(" Its cells are outlined.");
    }
    drawHeat(K);
    note.textContent = K > PAL.length ? `Colours repeat after ${PAL.length} clusters; grey = a single cell.` : "";
  }

  function drawBars(size: number[], bad: boolean[]): void {
    bars.replaceChildren();
    const K = size.length, W = 300, top = 22, H = 40, bw = W / Math.max(K, 1), mx = Math.max(...size);
    size.forEach((s, c) => {
      const h = Math.max(1.5, (H * s) / mx);
      const r = svgEl("rect", { x: (c * bw + 0.5).toFixed(1), y: (top + H - h).toFixed(1), width: Math.max(1, bw - 1.5).toFixed(1), height: h.toFixed(1) }, bars);
      r.style.fill = col(c, s);
      if (bad[c] && !refinedView) setAttrs(r, { stroke: "#111", "stroke-width": 2 });
      if (K <= 10) {
        const t = svgEl("text", { x: (c * bw + bw / 2).toFixed(1), y: (top + H - h - 4).toFixed(1), "text-anchor": "middle" }, bars);
        t.textContent = String(s);
      }
    });
    const t = svgEl("text", { x: 0, y: 82, class: "sub" }, bars);
    t.textContent = K > 10 ? `${K} bars, largest ${mx} cells` : "cells in each, largest first";
  }

  function drawHeat(K: number): void {
    heat.replaceChildren();
    const g = D!.ds.group, names = TRUE_NAMES[key];
    if (!g || names.length === 0) {
      agrLab.textContent = "Agreement with true groups: none here (one blob, no groups).";
      heat.setAttribute("viewBox", "0 0 300 1");
      return;
    }
    agrLab.textContent = `True group × ${refinedView ? "sub-cluster" : "cluster"}; agreement (ARI) ${ari(g, labels).toFixed(2)}`;
    const T = contingency(g, relabel(labels));
    const R = T.length, left = 58, rowH = 26, W = 300 - left, cw = W / K;
    heat.setAttribute("viewBox", `0 0 300 ${R * rowH + 2}`);
    T.forEach((row, a) => {
      const tot = row.reduce((s, x) => s + x, 0);
      const t = svgEl("text", { x: 0, y: a * rowH + 17 }, heat);
      t.textContent = names[a];
      t.setAttribute("y", String(a * rowH + 19));
      row.forEach((x, c) => {
        if (x === 0) return;
        const r = svgEl("rect", { x: (left + c * cw).toFixed(1), y: a * rowH + 1, width: Math.max(1, cw - 1).toFixed(1), height: rowH - 2 }, heat);
        r.style.fill = col(c, 2);
        r.style.opacity = (0.15 + 0.85 * x / tot).toFixed(2);
        if (cw >= 30) {
          const tx = svgEl("text", { x: (left + c * cw + cw / 2).toFixed(1), y: a * rowH + 19, "text-anchor": "middle" }, heat);
          tx.textContent = String(x);
        }
      });
      svgEl("line", { x1: left, x2: 300, y1: a * rowH + rowH, y2: a * rowH + rowH, stroke: "#ddd" }, heat);
    });
  }

  // first layout: after the page has painted (UMAP takes a few hundred ms)
  big.textContent = "computing the layout…";
  setTimeout(load, 30);
  (host as HTMLElement & { leidenState?: () => unknown }).leidenState = () => ({ key, k, gamma: gamma(), algo, seed, labels: Array.from(labels), step: stepNo, msg: stepMsg });
}

autoMount("leiden", mount);
