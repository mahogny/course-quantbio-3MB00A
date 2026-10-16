// Markov walkers: 200 dots hop around a state diagram according to a row-stochastic P.
// Side panel: fraction of walkers per state vs the exact x_t = x_0 P^t, and their history.
//
// <div data-demo="markov"
//      data-p="0.9 0.1 0.5 0.5"        transition matrix, row-major (rows are normalised)
//      data-states="R D"               state names (2-4 states)
//      data-label="Lecture R/D"        name of this chain's preset button
//      data-start="0"                  start state index ("all in ...")
//      data-presets="fast sticky absorbing periodic"   extra chains (keys of PRESETS)
//      data-seed="7"></div>
import { svgEl, htmlEl, button, presets, rng, numList, autoMount, releaseFocus } from "../lib/ui";
import { Chain, Mat, PRESETS, stepDist, stationary, setEntry, sampleRow, normaliseRows } from "./chain";

const NW = 200;            // number of walkers
const ANIM_MS = 650;       // hop animation
const RUN_MS = 1000;       // one step per second when running
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const CSS = `
[data-demo="markov"].qb-demo { display: block; }
[data-demo="markov"] .qbm-main { display: flex; flex-wrap: wrap; gap: .6em 1em; align-items: flex-start; }
[data-demo="markov"] .qbm-diagram { flex: 1 1 380px; max-width: 500px; min-width: 0; }
[data-demo="markov"] .qbm-right { flex: 1 1 420px; max-width: 620px; min-width: 0; display: flex; flex-direction: column; gap: .3em; }
[data-demo="markov"] .qbm-controls { display: flex; flex-direction: column; gap: .35em; margin-top: .4em; }
[data-demo="markov"] .qbm-row { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="markov"] .qbm-row .qb-presets { display: inline-flex; }
[data-demo="markov"] .qbm-lab { font-size: 18px; color: var(--qb-muted); margin-right: .2em; }
[data-demo="markov"] .qb-btn { font-size: 18px; padding: .2em .65em; }
[data-demo="markov"] .qbm-play { min-width: 5.2em; }
[data-demo="markov"] .qbm-table { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 18px; }
[data-demo="markov"] .qbm-table td, [data-demo="markov"] .qbm-table th { padding: 1px 10px; text-align: right; border: none; }
[data-demo="markov"] .qbm-table th { font-family: system-ui, sans-serif; }
[data-demo="markov"] .qbm-table td:first-child { text-align: left; font-family: system-ui, sans-serif; color: var(--qb-muted); }
[data-demo="markov"] .qbm-t { font-size: 24px; font-weight: 600; margin-right: .6em; }
[data-demo="markov"] .qbm-readout { display: flex; align-items: center; flex-wrap: wrap; background: var(--qb-panel); border-radius: 6px; padding: .2em .5em; }
[data-demo="markov"] .qbm-edit { display: grid; gap: .25em .8em; font-size: 18px; padding: .3em 0; }
[data-demo="markov"] .qbm-cell { display: flex; flex-direction: column; }
[data-demo="markov"] .qbm-cell span { font-family: ui-monospace, monospace; white-space: nowrap; }
[data-demo="markov"] .qbm-cell input { width: 100%; accent-color: var(--qb-accent); margin: 0; }
[data-demo="markov"] .qbm-edit .qbm-from { grid-column: 1 / -1; font-weight: 600; margin-top: .2em; }
[data-demo="markov"] .qbm-halo { paint-order: stroke; stroke: var(--qb-bg); stroke-width: 9px; stroke-linejoin: round; }
.reveal [data-demo="markov"].qb-demo { margin: 0; }
`;

function injectCss(): void {
  if (document.getElementById("qbm-style")) return;
  const s = document.createElement("style");
  s.id = "qbm-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const col = (k: number) => `var(--qb-c${(k % 5) + 1})`;
const fmtP = (v: number) => (Math.round(v * 100) / 100).toString().replace(/^0\./, "0.");
const f3 = (v: number) => v.toFixed(3);

type Pt = [number, number];

interface Layout { R: number; dot: number; centers: Pt[]; loopDir: number[]; bulge: number; diag: number }

function layout(n: number): Layout {
  if (n === 2) return { R: 76, dot: 3.6, centers: [[135, 245], [365, 245]], loopDir: [-Math.PI / 2, -Math.PI / 2], bulge: 48, diag: 48 };
  if (n === 3) {
    const centers: Pt[] = [[250, 150], [138, 340], [362, 340]];
    const deg = Math.PI / 180;
    return { R: 60, dot: 3.2, centers, loopDir: [-90 * deg, 155 * deg, 25 * deg], bulge: 22, diag: 22 };
  }
  const centers: Pt[] = [[130, 110], [370, 110], [370, 320], [130, 320]];
  return { R: 56, dot: 3, centers, loopDir: centers.map(([x, y]) => Math.atan2(y - 215, x - 250)), bulge: 16, diag: 44 };
}

function mount(host: HTMLElement): void {
  injectCss();
  // ---- chains from data-* ----
  const keys = (host.dataset.presets ?? "fast sticky absorbing").trim().split(/\s+/).filter(k => k in PRESETS);
  let own: Chain | null = null;
  if (host.dataset.p) {
    const v = numList(host.dataset.p, []);
    const n = Math.round(Math.sqrt(v.length));
    if (n >= 2 && n <= 4 && n * n === v.length) {
      const names = (host.dataset.states ?? "").trim().split(/\s+/).filter(Boolean);
      const states = names.length === n ? names : Array.from({ length: n }, (_, i) => String(i + 1));
      const P: Mat = [];
      for (let i = 0; i < n; i++) P.push(v.slice(i * n, i * n + n));
      own = { label: host.dataset.label ?? "Default", states, P: normaliseRows(P), start: Number(host.dataset.start ?? 0) || 0 };
    }
  }
  const chains: Chain[] = (own ? [own] : []).concat(keys.map(k => PRESETS[k]));
  if (chains.length === 0) chains.push(PRESETS.lecture);
  const seed = Number(host.dataset.seed ?? 7) || 7;

  // ---- state ----
  let chain = chains[0];
  let n = 2, P: Mat = [], states: string[] = [];
  let L = layout(2);
  let startMode = 0;              // 0..n-1: all in that state; -1: spread evenly
  let rand = rng(seed);
  let cur = new Int32Array(NW), slot = new Int32Array(NW);
  let occ: Uint8Array[] = [];
  let x0: number[] = [];
  let hist: { walk: number[]; exact: number[] }[] = [];
  let pi: number[] | null = null;
  let timer: number | null = null;
  // stay[w] >= 0: the walker stays in that state and rides round its self-loop.
  let anim: { from: Pt[]; fromK: Int32Array; ctrl: (Pt | null)[]; stay: Int32Array; to: Pt[]; t0: number } | null = null;

  // ---- DOM skeleton ----
  const main = htmlEl("div", "qbm-main", "", host);
  const dia = svgEl("svg", { viewBox: "0 0 500 430", class: "qbm-diagram", role: "img", "aria-label": "State diagram with walkers" }, main);
  const right = htmlEl("div", "qbm-right", "", main);
  const chart = svgEl("svg", { viewBox: "0 0 620 330", role: "img", "aria-label": "Fractions per state" }, right);
  const edit = htmlEl("div", "qbm-edit", "", right);
  edit.style.display = "none";
  const readout = htmlEl("div", "qbm-readout", "", right);
  const tOut = htmlEl("span", "qbm-t", "t = 0", readout);
  const table = htmlEl("table", "qbm-table", "", readout);

  const controls = htmlEl("div", "qbm-controls", "", host);
  const row1 = htmlEl("div", "qbm-row", "", controls);
  button(row1, "Step", () => { pause(); step(); });
  const playBtn = button(row1, "Run", () => (timer === null ? play() : pause()), "qbm-play");
  button(row1, "Reset", () => { pause(); reset(); });
  htmlEl("span", "qbm-lab", "  Start:", row1);
  const startHolder = htmlEl("span", "", "", row1);
  const row2 = htmlEl("div", "qbm-row", "", controls);
  htmlEl("span", "qbm-lab", "Chain:", row2);
  const chainBtns = presets(row2, chains.map(c => ({ label: c.label, apply: () => { pause(); load(c); } })));
  const editBtn = button(row2, "Edit P", () => {
    const on = edit.style.display === "none";
    edit.style.display = on ? "grid" : "none";
    chart.style.display = on ? "none" : "block";
    editBtn.classList.toggle("active", on);
  });

  // arrowhead marker
  const defs = svgEl("defs", {}, dia);
  const mid = "qbm-arrow-" + Math.random().toString(36).slice(2, 8);
  const mk = svgEl("marker", { id: mid, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 13, markerHeight: 13, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
  svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: "#555" }, mk);
  const gArrows = svgEl("g", {}, dia);
  const gNodes = svgEl("g", {}, dia);
  const gDots = svgEl("g", {}, dia);
  const gLabels = svgEl("g", {}, dia);
  const dots: SVGCircleElement[] = [];
  for (let w = 0; w < NW; w++) dots.push(svgEl("circle", { r: 3 }, gDots));

  // per-chain geometry
  let arcCtrl: Pt[][] = [];
  let loopPts: Pt[][] = [];   // per state: self-loop cubic [start, c1, c2, end]
  let arrowEls: { path: SVGPathElement; label: SVGTextElement }[][] = [];

  function slotPos(k: number, s: number): Pt {
    const [cx, cy] = L.centers[k];
    const r = (L.R - 7) * Math.sqrt((s + 0.5) / NW);
    return [cx + r * Math.cos(s * GOLDEN), cy + r * Math.sin(s * GOLDEN)];
  }

  function buildDiagram(): void {
    gArrows.replaceChildren(); gNodes.replaceChildren(); gLabels.replaceChildren();
    arcCtrl = []; arrowEls = []; loopPts = [];
    const { R, centers } = L;
    for (let i = 0; i < n; i++) {
      arcCtrl.push([]); arrowEls.push([]);
      for (let j = 0; j < n; j++) {
        const [xi, yi] = centers[i];
        let d: string, lx: number, ly: number, ctrl: Pt;
        if (i === j) {
          const phi = L.loopDir[i], a = 24 / R;
          const p = (ang: number, r: number): Pt => [xi + r * Math.cos(ang), yi + r * Math.sin(ang)];
          const ox = Math.cos(phi), oy = Math.sin(phi), tx = -oy, ty = ox;   // outward and tangent
          const q = (out: number, side: number): Pt => [xi + ox * out + tx * side, yi + oy * out + ty * side];
          const s = p(phi - a, R), e = p(phi + a, R + 3), c1 = q(R + 66, -38), c2 = q(R + 66, 38);
          d = `M${s} C${c1} ${c2} ${e}`;
          [lx, ly] = q(R + 74, 0);
          ctrl = p(phi, R + 30);
          loopPts[i] = [s, c1, c2, e];
        } else {
          const [xj, yj] = centers[j];
          const len = Math.hypot(xj - xi, yj - yi);
          const ux = (xj - xi) / len, uy = (yj - yi) / len;
          const nx = uy, ny = -ux;   // bulge side: i->j and j->i end up on opposite sides
          const a = 0.42, ca = Math.cos(a), sa = Math.sin(a);
          const s: Pt = [xi + R * (ux * ca + nx * sa), yi + R * (uy * ca + ny * sa)];
          const e: Pt = [xj + (R + 2) * (-ux * ca + nx * sa), yj + (R + 2) * (-uy * ca + ny * sa)];
          const b = (n === 4 && (i + j) % 2 === 0 ? L.diag : L.bulge) * 2;   // diagonals of the square bend more
          ctrl = [(xi + xj) / 2 + nx * b, (yi + yj) / 2 + ny * b];
          d = `M${s} Q${ctrl} ${e}`;
          lx = 0.25 * s[0] + 0.5 * ctrl[0] + 0.25 * e[0];
          ly = 0.25 * s[1] + 0.5 * ctrl[1] + 0.25 * e[1];
        }
        arcCtrl[i].push(ctrl);
        const path = svgEl("path", { d, fill: "none", stroke: "#666", "marker-end": `url(#${mid})` }, gArrows);
        const label = svgEl("text", { x: lx, y: ly + 7, "text-anchor": "middle", "font-size": 22, class: "qbm-halo" }, gLabels);
        arrowEls[i].push({ path, label });
      }
      const [x, y] = centers[i];
      svgEl("circle", { cx: x, cy: y, r: R, fill: "none", "stroke-width": 3, style: `stroke:${col(i)}` }, gNodes);
      svgEl("circle", { cx: x, cy: y, r: R, style: `fill:${col(i)}`, "fill-opacity": 0.08 }, gNodes);
      const t = svgEl("text", { x, y: y + 8, "text-anchor": "middle", "font-size": 26, "font-weight": 700, class: "qbm-halo" }, gLabels);
      t.textContent = states[i];
    }
    for (let w = 0; w < NW; w++) dots[w].setAttribute("r", String(L.dot));
  }

  function updateArrows(): void {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const { path, label } = arrowEls[i][j];
      const p = P[i][j], show = p > 1e-9;
      path.style.display = label.style.display = show ? "" : "none";
      path.setAttribute("stroke-width", String(1.5 + 4 * p));
      label.textContent = fmtP(p);
    }
  }

  // ---- edit panel ----
  let editInputs: { inp: HTMLInputElement; out: HTMLSpanElement }[][] = [];
  function buildEdit(): void {
    edit.replaceChildren();
    edit.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    editInputs = [];
    for (let i = 0; i < n; i++) {
      htmlEl("div", "qbm-from", `from ${states[i]}  (row ${i + 1}, sums to 1)`, edit);
      editInputs.push([]);
      for (let j = 0; j < n; j++) {
        const cell = htmlEl("label", "qbm-cell", "", edit);
        const out = htmlEl("span", "", "", cell);
        const inp = htmlEl("input", "", "", cell);
        Object.assign(inp, { type: "range", min: "0", max: "1", step: "0.01" });
        inp.addEventListener("input", () => {
          setEntry(P, i, j, Number(inp.value));
          chainBtns.forEach(b => b.classList.remove("active"));
          syncEdit(); updateArrows(); reset();
        });
        releaseFocus(inp);
        editInputs[i].push({ inp, out });
      }
    }
    syncEdit();
  }
  function syncEdit(): void {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const { inp, out } = editInputs[i][j];
      if (document.activeElement !== inp) inp.value = String(P[i][j]);
      out.textContent = `${states[i]}→${states[j]} ${P[i][j].toFixed(2)}`;
    }
  }

  // ---- start buttons ----
  let startBtns: HTMLButtonElement[] = [];
  function buildStart(): void {
    startHolder.replaceChildren();
    const items = states.map((s, k) => ({ label: `all in ${s}`, apply: () => { pause(); startMode = k; reset(); } }));
    items.push({ label: "spread evenly", apply: () => { pause(); startMode = -1; reset(); } });
    startBtns = presets(startHolder, items);
    markStart();
  }
  function markStart(): void {
    startBtns.forEach((b, k) => b.classList.toggle("active", startMode === -1 ? k === n : k === startMode));
  }

  // ---- simulation ----
  function fractions(): number[] {
    const f = new Array(n).fill(0);
    for (let w = 0; w < NW; w++) f[cur[w]] += 1 / NW;
    return f;
  }

  function reset(): void {
    rand = rng(seed);
    anim = null;
    occ = Array.from({ length: n }, () => new Uint8Array(NW));
    const counts = new Array(n).fill(0);
    for (let w = 0; w < NW; w++) {
      const k = startMode === -1 ? w % n : startMode;
      cur[w] = k; slot[w] = counts[k]; occ[k][counts[k]] = 1; counts[k]++;
    }
    x0 = counts.map(c => c / NW);
    pi = stationary(P);
    hist = [{ walk: fractions(), exact: x0.slice() }];
    markStart();
    placeDots();
    drawCharts();
  }

  function placeDots(): void {
    for (let w = 0; w < NW; w++) {
      const [x, y] = slotPos(cur[w], slot[w]);
      setDot(w, x, y, cur[w]);
    }
  }
  function setDot(w: number, x: number, y: number, k: number): void {
    const d = dots[w];
    d.setAttribute("cx", x.toFixed(1)); d.setAttribute("cy", y.toFixed(1));
    d.style.fill = col(k);
  }

  function step(): void {
    if (anim) finishAnim();
    const nxt = new Int32Array(NW);
    for (let w = 0; w < NW; w++) nxt[w] = sampleRow(P[cur[w]], rand.unif());
    const from: Pt[] = [], to: Pt[] = [], ctrl: (Pt | null)[] = [], fromK = cur.slice();
    const stay = new Int32Array(NW).fill(-1);
    for (let w = 0; w < NW; w++) {
      from.push(slotPos(cur[w], slot[w]));
      if (nxt[w] !== cur[w]) occ[cur[w]][slot[w]] = 0;   // leavers free their slot first
    }
    for (let w = 0; w < NW; w++) {
      const i = cur[w], j = nxt[w];
      if (i !== j) {
        let s = 0;
        while (occ[j][s]) s++;
        occ[j][s] = 1; slot[w] = s;
        ctrl.push(arcCtrl[i][j]);
      } else { ctrl.push(null); stay[w] = i; }
      cur[w] = j;
      to.push(slotPos(j, slot[w]));
    }
    const prev = hist[hist.length - 1].exact;
    hist.push({ walk: fractions(), exact: stepDist(prev, P) });
    anim = { from, fromK, ctrl, stay, to, t0: performance.now() };
    requestAnimationFrame(frame);
    drawCharts();
  }

  function frame(now: number): void {
    if (!anim) return;
    const u = Math.min(1, (now - anim.t0) / ANIM_MS);
    const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
    for (let w = 0; w < NW; w++) {
      const [ax, ay] = anim.from[w], [bx, by] = anim.to[w], c = anim.ctrl[w];
      let x: number, y: number;
      if (anim.stay[w] >= 0) [x, y] = loopRide(anim.from[w], anim.stay[w], e);
      else if (c) {
        x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * c[0] + e * e * bx;
        y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * c[1] + e * e * by;
      } else { x = ax + (bx - ax) * e; y = ay + (by - ay) * e; }
      setDot(w, x, y, e < 0.5 ? anim.fromK[w] : cur[w]);
    }
    if (u < 1) requestAnimationFrame(frame);
    else anim = null;
  }
  // A staying walker leaves its slot, follows the self-loop arrow out and back in,
  // and returns to the same slot, so "stay" (A→A) is visible as a hop too. Each
  // walker keeps a scaled-down copy of its slot offset, so the stayers travel round
  // the loop as a small cloud instead of one stacked dot.
  function loopRide(home: Pt, k: number, e: number): Pt {
    const [s, c1, c2, en] = loopPts[k], [cx, cy] = L.centers[k];
    const ox = (home[0] - cx) * 0.3, oy = (home[1] - cy) * 0.3;
    const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (e < 0.2) return lerp(home, [s[0] + ox, s[1] + oy], e / 0.2);
    if (e > 0.8) return lerp([en[0] + ox, en[1] + oy], home, (e - 0.8) / 0.2);
    const t = (e - 0.2) / 0.6, m = 1 - t;
    return [m * m * m * s[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * en[0] + ox,
            m * m * m * s[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * en[1] + oy];
  }
  function finishAnim(): void { anim = null; placeDots(); }

  function play(): void {
    if (timer !== null) return;
    step();
    timer = window.setInterval(step, RUN_MS);
    playBtn.textContent = "Pause";
    playBtn.classList.add("active");
  }
  function pause(): void {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playBtn.textContent = "Run";
    playBtn.classList.remove("active");
  }

  // ---- charts ----
  function drawCharts(): void {
    chart.replaceChildren();
    const t = hist.length - 1, now = hist[t];
    const txt = (x: number, y: number, s: string, attrs: Record<string, string | number> = {}) => {
      const e = svgEl("text", { x, y, "font-size": 20, ...attrs }, chart);
      e.textContent = s;
      return e;
    };
    // --- bar chart (top) ---
    const bx0 = 60, bx1 = 610, by0 = 128, by1 = 22;
    const yb = (v: number) => by0 + (by1 - by0) * v;
    for (const v of [0, 0.5, 1]) {
      svgEl("line", { x1: bx0, x2: bx1, y1: yb(v), y2: yb(v), class: v === 0 ? "axis" : "grid" }, chart);
      txt(bx0 - 8, yb(v) + 6, String(v), { "text-anchor": "end" });
    }
    const gw = (bx1 - bx0) / n, bw = Math.min(54, gw * 0.28);
    for (let k = 0; k < n; k++) {
      const gx = bx0 + gw * (k + 0.5);
      const w = now.walk[k], ex = now.exact[k];
      svgEl("rect", { x: gx - bw - 2, y: yb(w), width: bw, height: by0 - yb(w), style: `fill:${col(k)}` }, chart);
      svgEl("rect", { x: gx + 2, y: yb(ex), width: bw, height: by0 - yb(ex), "fill-opacity": 0.25, "stroke-width": 2.5, style: `fill:${col(k)};stroke:${col(k)}` }, chart);
      if (pi) svgEl("line", { x1: gx - bw - 10, x2: gx + bw + 10, y1: yb(pi[k]), y2: yb(pi[k]), stroke: "#222", "stroke-width": 2.5, "stroke-dasharray": "7 4" }, chart);
      txt(gx, by0 + 22, states[k], { "text-anchor": "middle", "font-weight": 700 });
    }
    // legend
    const lgY = 176;
    svgEl("rect", { x: 60, y: lgY - 14, width: 16, height: 16, fill: "#666" }, chart);
    txt(82, lgY, "walkers");
    svgEl("rect", { x: 166, y: lgY - 14, width: 16, height: 16, fill: "#666", "fill-opacity": 0.25, stroke: "#666", "stroke-width": 2 }, chart);
    txt(188, lgY, "exact xₜ = x₀Pᵗ");
    svgEl("line", { x1: 352, x2: 382, y1: lgY - 6, y2: lgY - 6, stroke: "#222", "stroke-width": 2.5, "stroke-dasharray": "7 4" }, chart);
    txt(388, lgY, pi ? "long-run π (πP = π)" : "π not unique");

    // --- line plot (bottom) ---
    const lx0 = 60, lx1 = 600, ly0 = 300, ly1 = 196;
    const T = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => v >= t) ?? t;
    const xs = (s: number) => lx0 + (lx1 - lx0) * s / T;
    const ys = (v: number) => ly0 + (ly1 - ly0) * v;
    for (const v of [0, 1]) {
      svgEl("line", { x1: lx0, x2: lx1, y1: ys(v), y2: ys(v), class: v === 0 ? "axis" : "grid" }, chart);
      txt(lx0 - 8, ys(v) + 6, String(v), { "text-anchor": "end" });
    }
    for (const s of [0, T / 2, T]) txt(xs(s), ly0 + 22, String(s), { "text-anchor": "middle" });
    txt((xs(T / 2) + xs(T)) / 2, ly0 + 22, "step t", { "text-anchor": "middle", fill: "#777" });
    for (let k = 0; k < n; k++) {
      if (pi) svgEl("line", { x1: lx0, x2: lx1, y1: ys(pi[k]), y2: ys(pi[k]), "stroke-width": 2, "stroke-dasharray": "7 4", style: `stroke:${col(k)}` }, chart);
      const ptsE = hist.map((h, s) => `${xs(s).toFixed(1)},${ys(h.exact[k]).toFixed(1)}`).join(" ");
      const ptsW = hist.map((h, s) => `${xs(s).toFixed(1)},${ys(h.walk[k]).toFixed(1)}`).join(" ");
      svgEl("polyline", { points: ptsE, fill: "none", "stroke-width": 6, "stroke-opacity": 0.25, "stroke-linejoin": "round", style: `stroke:${col(k)}` }, chart);
      svgEl("polyline", { points: ptsW, fill: "none", "stroke-width": 2.2, "stroke-linejoin": "round", style: `stroke:${col(k)}` }, chart);
      if (t <= 50) hist.forEach((h, s) => svgEl("circle", { cx: xs(s), cy: ys(h.walk[k]), r: 3.2, style: `fill:${col(k)}` }, chart));
    }

    // --- readout ---
    tOut.textContent = `t = ${t}`;
    table.replaceChildren();
    const hr = htmlEl("tr", "", "", table);
    htmlEl("th", "", "", hr);
    states.forEach((s, k) => { const th = htmlEl("th", "", s, hr); th.style.color = col(k); });
    const row = (name: string, v: number[] | null) => {
      const tr = htmlEl("tr", "", "", table);
      htmlEl("td", "", name, tr);
      for (let k = 0; k < n; k++) htmlEl("td", "", v ? f3(v[k]) : "–", tr);
    };
    row("walkers", now.walk);
    row("exact xₜ", now.exact);
    row("long-run π", pi);
  }

  // ---- load a chain ----
  function load(c: Chain): void {
    chain = c;
    n = c.states.length;
    states = c.states.slice();
    P = c.P.map(r => r.slice());
    L = layout(n);
    dia.setAttribute("viewBox", n === 2 ? "0 80 500 290" : "0 0 500 430");
    startMode = Math.min(n - 1, Math.max(0, c.start ?? 0));
    buildDiagram();
    updateArrows();
    buildEdit();
    buildStart();
    reset();
  }

  chainBtns[0].classList.add("active");
  load(chain);
}

autoMount("markov", mount);
