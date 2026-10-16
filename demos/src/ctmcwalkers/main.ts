// Continuous-time Markov walkers: 200 dots on a state diagram whose arrows carry RATES.
// Each walker waits an exponential time (rate = total leaving rate of its state), then
// hops along one arrow (chosen with probability rate / leaving rate). Walkers move one
// at a time while a continuous clock runs; there are no global steps.
// Side panel: fraction of walkers per state vs the exact x(t) (dx/dt = xQ, RK4), the
// stationary pi (pi Q = 0) and the fractions over time. Optional: follow one walker
// and draw its state over time (bars of exponential, random length).
//
// <div data-demo="ctmcwalkers"
//      data-q="0 0.5 0.25 0"          rates, row-major n x n (diagonal ignored)
//      data-states="ON OFF"            state names (2-4 states)
//      data-label="Promoter ON/OFF"    name of this chain's preset button
//      data-unit="/min"                rate unit ("" for none)
//      data-start="0"                  start state index ("all in ...")
//      data-speed="1"                  time units per second
//      data-presets="fast slow cell3 absorbing jc"   extra chains (keys of PRESETS)
//      data-follow="1"                 show the one-walker timeline from the start
//      data-seed="7"></div>
import { svgEl, htmlEl, button, presets, checkbox, slider, rng, numList, autoMount, releaseFocus } from "../lib/ui";
import { CChain, Mat, PRESETS, rateMatrix, leaveRate, advance, stationary, expSample, pickJump } from "./ctmc";

const NW = 200;             // number of walkers
const HOP_MS = 450;         // real duration of one animated hop
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPEEDS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const FOLLOW = 0;           // index of the highlighted walker

const CSS = `
[data-demo="ctmcwalkers"].qb-demo { display: block; }
[data-demo="ctmcwalkers"] .qbc-main { display: flex; flex-wrap: wrap; gap: .6em 1em; align-items: flex-start; }
[data-demo="ctmcwalkers"] .qbc-diagram { flex: 1 1 380px; max-width: 480px; min-width: 0; }
[data-demo="ctmcwalkers"] .qbc-right { flex: 1 1 420px; max-width: 620px; min-width: 0; display: flex; flex-direction: column; gap: .3em; }
[data-demo="ctmcwalkers"] .qbc-controls { display: flex; flex-direction: column; gap: .35em; margin-top: .4em; }
[data-demo="ctmcwalkers"] .qbc-row { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="ctmcwalkers"] .qbc-row .qb-presets { display: inline-flex; }
[data-demo="ctmcwalkers"] .qbc-lab { font-size: 18px; color: var(--qb-muted); margin-right: .2em; }
[data-demo="ctmcwalkers"] .qb-btn { font-size: 18px; padding: .2em .65em; }
[data-demo="ctmcwalkers"] .qbc-play { min-width: 5.2em; }
.qb-demo[data-demo="ctmcwalkers"] .qb-slider { display: inline-flex; align-items: center; gap: .4em; font-size: 18px; margin: 0 .4em; flex-shrink: 0; }
.qb-demo[data-demo="ctmcwalkers"] .qb-slider input[type=range] { width: 7em; min-width: 0; }
.qb-demo[data-demo="ctmcwalkers"] .qb-slider output { display: inline-block; white-space: nowrap; width: 6.8em; text-align: left; }
[data-demo="ctmcwalkers"] .qb-check { font-size: 18px; margin-left: .4em; }
[data-demo="ctmcwalkers"] .qbc-table { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 18px; }
[data-demo="ctmcwalkers"] .qbc-table td, [data-demo="ctmcwalkers"] .qbc-table th { padding: 1px 10px; text-align: right; border: none; }
[data-demo="ctmcwalkers"] .qbc-table th { font-family: system-ui, sans-serif; }
[data-demo="ctmcwalkers"] .qbc-table td:first-child { text-align: left; font-family: system-ui, sans-serif; color: var(--qb-muted); }
[data-demo="ctmcwalkers"] .qbc-t { font-size: 24px; font-weight: 600; margin-right: .6em; min-width: 6.5em; }
[data-demo="ctmcwalkers"] .qbc-readout { display: flex; align-items: center; flex-wrap: wrap; background: var(--qb-panel); border-radius: 6px; padding: .2em .5em; }
[data-demo="ctmcwalkers"] .qbc-edit { display: grid; gap: .25em .8em; font-size: 18px; padding: .3em 0; }
[data-demo="ctmcwalkers"] .qbc-cell { display: flex; flex-direction: column; }
[data-demo="ctmcwalkers"] .qbc-cell span { font-family: ui-monospace, monospace; white-space: nowrap; }
[data-demo="ctmcwalkers"] .qbc-cell input { width: 100%; accent-color: var(--qb-accent); margin: 0; }
[data-demo="ctmcwalkers"] .qbc-edit .qbc-from { grid-column: 1 / -1; font-weight: 600; margin-top: .2em; }
[data-demo="ctmcwalkers"] .qbc-halo { paint-order: stroke; stroke: var(--qb-bg); stroke-width: 8px; stroke-linejoin: round; }
.reveal [data-demo="ctmcwalkers"].qb-demo { margin: 0; }
`;

function injectCss(): void {
  if (document.getElementById("qbc-style")) return;
  const s = document.createElement("style");
  s.id = "qbc-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

const col = (k: number) => `var(--qb-c${(k % 5) + 1})`;
const fmtR = (v: number) => String(Math.round(v * 100) / 100);
const f3 = (v: number) => v.toFixed(3);
const fmtT = (v: number) => (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0));
const nice = (v: number) => {
  for (let p = 1; ; p *= 10) for (const m of [1, 2, 5]) if (m * p >= v) return m * p;
};
const niceUp = (v: number) => [0.5, 1, 2, 5, 10, 20, 50].find(m => m >= v) ?? Math.ceil(v);

type Pt = [number, number];

interface Layout { R: number; dot: number; centers: Pt[]; bulge: number; diag: number; top: number; h: number }

function layout(n: number): Layout {
  if (n === 2) return { R: 70, dot: 3.4, centers: [[110, 125], [390, 125]], bulge: 40, diag: 40, top: 22, h: 206 };
  if (n === 3) return { R: 56, dot: 3.0, centers: [[250, 82], [112, 290], [388, 290]], bulge: 24, diag: 24, top: 14, h: 352 };
  return { R: 52, dot: 2.9, centers: [[125, 85], [375, 85], [375, 290], [125, 290]], bulge: 16, diag: 44, top: 14, h: 352 };
}

interface HistPt { t: number; walk: number[]; exact: number[] }

function mount(host: HTMLElement): void {
  injectCss();
  // ---- chains from data-* ----
  const keys = (host.dataset.presets ?? "fast slow cell3 absorbing").trim().split(/\s+/).filter(k => k in PRESETS);
  let own: CChain | null = null;
  if (host.dataset.q) {
    const v = numList(host.dataset.q, []);
    const n = Math.round(Math.sqrt(v.length));
    if (n >= 2 && n <= 4 && n * n === v.length) {
      const names = (host.dataset.states ?? "").trim().split(/\s+/).filter(Boolean);
      const states = names.length === n ? names : Array.from({ length: n }, (_, i) => String(i + 1));
      const R: Mat = [];
      for (let i = 0; i < n; i++) R.push(v.slice(i * n, i * n + n).map((x, j) => (i === j ? 0 : Math.max(0, x))));
      own = {
        label: host.dataset.label ?? "Default", states, R,
        start: Number(host.dataset.start ?? 0) || 0,
        unit: host.dataset.unit ?? "/min",
        speed: Number(host.dataset.speed ?? 1) || 1,
        view: Number(host.dataset.view ?? 10) || 10,
      };
    }
  }
  const chains: CChain[] = (own ? [own] : []).concat(keys.map(k => PRESETS[k]));
  if (chains.length === 0) chains.push(PRESETS.telegraph);
  const seed = Number(host.dataset.seed ?? 7) || 7;
  let follow = host.dataset.follow === "1";

  // ---- state ----
  let chain = chains[0];
  let n = 2, R: Mat = [], Q: Mat = [], states: string[] = [], unit = "/min", tu = "min";
  let L = layout(2);
  let startMode = 0;              // 0..n-1: all in that state; -1: spread evenly
  let speed = 1, view = 10;
  let T = 0;                      // model clock
  let running = false, lastNow = 0, frameNo = 0, loopToken = 0;   // token: only one animation loop at a time
  let rands = Array.from({ length: NW }, () => rng(1));
  const cur = new Int32Array(NW), slot = new Int32Array(NW);
  const nextT = new Float64Array(NW);
  let occ: Uint8Array[] = [];
  let xEx: number[] = [];
  let hist: HistPt[] = [];
  let pi: number[] | null = null;
  let jumps = 0;
  let track: { t: number; k: number }[] = [];      // followed walker: (jump time, new state)
  // per-walker hop animation (real time)
  const hopT0 = new Float64Array(NW).fill(NaN);
  const hopFrom: Pt[] = new Array(NW), hopTo: Pt[] = new Array(NW), hopCtrl: Pt[] = new Array(NW);
  const hopK = new Int32Array(NW);

  // ---- DOM skeleton ----
  const main = htmlEl("div", "qbc-main", "", host);
  const dia = svgEl("svg", { viewBox: "0 0 500 430", class: "qbc-diagram", role: "img", "aria-label": "State diagram with walkers" }, main);
  const right = htmlEl("div", "qbc-right", "", main);
  const chart = svgEl("svg", { viewBox: "0 0 620 330", role: "img", "aria-label": "Fractions per state" }, right);
  const edit = htmlEl("div", "qbc-edit", "", right);
  edit.style.display = "none";
  const readout = htmlEl("div", "qbc-readout", "", right);
  const tOut = htmlEl("span", "qbc-t", "t = 0", readout);
  const table = htmlEl("table", "qbc-table", "", readout);

  const controls = htmlEl("div", "qbc-controls", "", host);
  const row1 = htmlEl("div", "qbc-row", "", controls);
  const playBtn = button(row1, "Run", () => (running ? pause() : play()), "qbc-play");
  button(row1, "Reset", () => { pause(); reset(); });
  const speedSl = slider(row1, "speed", 0, SPEEDS.length - 1, 1, 4, i => { speed = SPEEDS[i]; },
    i => `${SPEEDS[i]} ${tu || "unit"}/s`);
  htmlEl("span", "qbc-lab", "Start:", row1);
  const startHolder = htmlEl("span", "", "", row1);
  const row2 = htmlEl("div", "qbc-row", "", controls);
  htmlEl("span", "qbc-lab", "Chain:", row2);
  const chainBtns = presets(row2, chains.map(c => ({ label: c.label, apply: () => { pause(); load(c); } })));
  const editBtn = button(row2, "Edit rates", () => {
    const on = edit.style.display === "none";
    edit.style.display = on ? "grid" : "none";
    chart.style.display = on ? "none" : "block";
    editBtn.classList.toggle("active", on);
  });
  checkbox(row2, "follow one walker", follow, v => { follow = v; sizeDiagram(); drawFollow(); drawTimeline(); });

  // arrowhead marker
  const defs = svgEl("defs", {}, dia);
  const mid = "qbc-arrow-" + Math.random().toString(36).slice(2, 8);
  const mk = svgEl("marker", { id: mid, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 13, markerHeight: 13, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
  svgEl("path", { d: "M0,0 L10,5 L0,10 z", fill: "#555" }, mk);
  const gArrows = svgEl("g", {}, dia);
  const gNodes = svgEl("g", {}, dia);
  const gDots = svgEl("g", {}, dia);
  const gLabels = svgEl("g", {}, dia);
  const gTl = svgEl("g", {}, dia);
  const dots: SVGCircleElement[] = [];
  for (let w = 0; w < NW; w++) dots.push(svgEl("circle", { r: 3 }, gDots));
  // the followed walker is drawn last, on top
  gDots.appendChild(dots[FOLLOW]);

  let arcCtrl: Pt[][] = [];
  let arrowEls: ({ path: SVGPathElement; label: SVGTextElement } | null)[][] = [];

  function slotPos(k: number, s: number): Pt {
    const [cx, cy] = L.centers[k];
    const r = (L.R - 7) * Math.sqrt((s + 0.5) / NW);
    return [cx + r * Math.cos(s * GOLDEN), cy + r * Math.sin(s * GOLDEN)];
  }

  const tlHeight = () => 40 + n * 28 + 30;
  function sizeDiagram(): void {
    const h = L.h + (follow ? tlHeight() : 0);
    dia.setAttribute("viewBox", `0 ${L.top} 500 ${h}`);
    gTl.style.display = follow ? "" : "none";
  }

  function buildDiagram(): void {
    gArrows.replaceChildren(); gNodes.replaceChildren(); gLabels.replaceChildren();
    arcCtrl = []; arrowEls = [];
    const { R: rad, centers } = L;
    for (let i = 0; i < n; i++) {
      arcCtrl.push([]); arrowEls.push([]);
      for (let j = 0; j < n; j++) {
        if (i === j) { arcCtrl[i].push([0, 0]); arrowEls[i].push(null); continue; }   // no self-loops
        const [xi, yi] = centers[i], [xj, yj] = centers[j];
        const len = Math.hypot(xj - xi, yj - yi);
        const ux = (xj - xi) / len, uy = (yj - yi) / len;
        const nx = uy, ny = -ux;   // bulge side: i->j and j->i end up on opposite sides
        const a = 0.42, ca = Math.cos(a), sa = Math.sin(a);
        const s: Pt = [xi + rad * (ux * ca + nx * sa), yi + rad * (uy * ca + ny * sa)];
        const e: Pt = [xj + (rad + 2) * (-ux * ca + nx * sa), yj + (rad + 2) * (-uy * ca + ny * sa)];
        const b = (n === 4 && (i + j) % 2 === 0 ? L.diag : L.bulge) * 2;   // diagonals of the square bend more
        const ctrl: Pt = [(xi + xj) / 2 + nx * b, (yi + yj) / 2 + ny * b];
        // label just outside the arc: at its middle, or nearer the source in the
        // triangle, so the three labels inside the triangle do not meet in the centre
        const tl = n === 3 || (n === 4 && (i + j) % 2 === 0) ? 0.3 : 0.5, m1 = (1 - tl) * (1 - tl), m2 = 2 * tl * (1 - tl), m3 = tl * tl;
        const lx = m1 * s[0] + m2 * ctrl[0] + m3 * e[0] + nx * 16;
        const ly = m1 * s[1] + m2 * ctrl[1] + m3 * e[1] + ny * 16 - 7 * (1 - Math.abs(ny));
        arcCtrl[i].push(ctrl);
        const path = svgEl("path", { d: `M${s} Q${ctrl} ${e}`, fill: "none", stroke: "#666", "marker-end": `url(#${mid})` }, gArrows);
        const label = svgEl("text", { x: lx, y: ly + 7, "text-anchor": "middle", "font-size": 20, class: "qbc-halo" }, gLabels);
        arrowEls[i].push({ path, label });
      }
      const [x, y] = centers[i];
      svgEl("circle", { cx: x, cy: y, r: rad, fill: "none", "stroke-width": 3, style: `stroke:${col(i)}` }, gNodes);
      svgEl("circle", { cx: x, cy: y, r: rad, style: `fill:${col(i)}`, "fill-opacity": 0.08 }, gNodes);
      const t = svgEl("text", { x, y: y + 8, "text-anchor": "middle", "font-size": 24, "font-weight": 700, class: "qbc-halo" }, gLabels);
      t.textContent = states[i];
    }
    if (n === 4 && unit) {
      const t = svgEl("text", { x: 250, y: L.top + L.h - 6, "text-anchor": "middle", "font-size": 18, fill: "#777" }, gLabels);
      t.textContent = `rates in ${unit}`;
    }
    for (let w = 0; w < NW; w++) dots[w].setAttribute("r", String(L.dot));
    drawFollow();
  }

  function drawFollow(): void {
    const d = dots[FOLLOW];
    d.setAttribute("r", String(follow ? L.dot * 2.2 : L.dot));
    d.setAttribute("stroke", follow ? "#000" : "none");
    d.setAttribute("stroke-width", follow ? "2" : "0");
  }

  function updateArrows(): void {
    let rmax = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) rmax = Math.max(rmax, R[i][j]);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const el = arrowEls[i][j];
      if (!el) continue;
      const r = R[i][j], show = r > 1e-9;
      el.path.style.display = el.label.style.display = show ? "" : "none";
      el.path.setAttribute("stroke-width", String(1.5 + 4 * (rmax > 0 ? r / rmax : 0)));
      el.label.textContent = n <= 3 && unit ? `${fmtR(r)} ${unit}` : fmtR(r);
    }
  }

  // ---- edit panel: one slider per arrow ----
  let editInputs: ({ inp: HTMLInputElement; out: HTMLSpanElement } | null)[][] = [];
  let editHeads: HTMLDivElement[] = [];
  function buildEdit(): void {
    edit.replaceChildren();
    edit.style.gridTemplateColumns = `repeat(${n - 1}, minmax(0, 1fr))`;
    editInputs = []; editHeads = [];
    let m = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) m = Math.max(m, R[i][j]);
    const rmax = niceUp(2 * m || 1);
    for (let i = 0; i < n; i++) {
      editHeads.push(htmlEl("div", "qbc-from", "", edit));
      editInputs.push([]);
      for (let j = 0; j < n; j++) {
        if (i === j) { editInputs[i].push(null); continue; }
        const cell = htmlEl("label", "qbc-cell", "", edit);
        const out = htmlEl("span", "", "", cell);
        const inp = htmlEl("input", "", "", cell);
        Object.assign(inp, { type: "range", min: "0", max: String(rmax), step: "0.01" });
        inp.addEventListener("input", () => {
          R[i][j] = Number(inp.value);
          Q = rateMatrix(R);
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
    for (let i = 0; i < n; i++) {
      const q = leaveRate(R, i);
      editHeads[i].textContent = q > 0
        ? `from ${states[i]}: leaves at ${fmtR(q)} ${unit}, mean wait ${fmtT(1 / q)} ${tu}`
        : `from ${states[i]}: no way out (absorbing)`;
      for (let j = 0; j < n; j++) {
        const e = editInputs[i][j];
        if (!e) continue;
        if (document.activeElement !== e.inp) e.inp.value = String(R[i][j]);
        e.out.textContent = `${states[i]}→${states[j]} ${R[i][j].toFixed(2)}`;
      }
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
    // one random stream per walker, so a walker's path does not depend on frame timing
    rands = Array.from({ length: NW }, (_, w) => rng(seed * 7919 + w * 104729 + 1));
    T = 0; jumps = 0;
    hopT0.fill(NaN);
    occ = Array.from({ length: n }, () => new Uint8Array(NW));
    const counts = new Array(n).fill(0);
    for (let w = 0; w < NW; w++) {
      const k = startMode === -1 ? w % n : startMode;
      cur[w] = k; slot[w] = counts[k]; occ[k][counts[k]] = 1; counts[k]++;
      nextT[w] = expSample(leaveRate(R, k), rands[w].unif());
    }
    xEx = counts.map(c => c / NW);
    pi = stationary(Q);
    hist = [{ t: 0, walk: fractions(), exact: xEx.slice() }];
    track = [{ t: 0, k: cur[FOLLOW] }];
    markStart();
    placeDots();
    drawCharts();
    drawTimeline();
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

  /** Let every walker whose jump time has passed jump (possibly several times). */
  function processJumps(now: number): void {
    for (let w = 0; w < NW; w++) {
      while (nextT[w] <= T) {
        const i = cur[w], j = pickJump(R, i, rands[w].unif());
        if (j === i) { nextT[w] = Infinity; break; }
        const from = slotPos(i, slot[w]);
        occ[i][slot[w]] = 0;
        let s = 0;
        while (occ[j][s]) s++;
        occ[j][s] = 1; slot[w] = s; cur[w] = j;
        hopFrom[w] = from; hopTo[w] = slotPos(j, s); hopCtrl[w] = arcCtrl[i][j]; hopK[w] = i;
        hopT0[w] = now - ((T - nextT[w]) / speed) * 1000;   // started when the jump happened
        if (w === FOLLOW) track.push({ t: nextT[w], k: j });
        jumps++;
        nextT[w] += expSample(leaveRate(R, j), rands[w].unif());
      }
    }
    if (track.length > 4000) track = track.slice(-3000);
  }

  function animateHops(now: number): void {
    for (let w = 0; w < NW; w++) {
      if (Number.isNaN(hopT0[w])) continue;
      const u = Math.max(0, (now - hopT0[w]) / HOP_MS);
      if (u >= 1) {
        hopT0[w] = NaN;
        setDot(w, hopTo[w][0], hopTo[w][1], cur[w]);
        continue;
      }
      const e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      const [ax, ay] = hopFrom[w], [bx, by] = hopTo[w], c = hopCtrl[w];
      const x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * c[0] + e * e * bx;
      const y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * c[1] + e * e * by;
      setDot(w, x, y, e < 0.5 ? hopK[w] : cur[w]);
    }
  }

  function frame(now: number, tok: number): void {
    if (!running || tok !== loopToken) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) * speed;
    lastNow = now;
    if (dt > 0) {
      T += dt;
      processJumps(now);
      xEx = advance(xEx, Q, dt);
      hist.push({ t: T, walk: fractions(), exact: xEx.slice() });
      if (hist.length > 900) hist = hist.filter((_, k) => k % 2 === 0 || k === hist.length - 1);
    }
    animateHops(now);
    if (frameNo++ % 3 === 0) { drawCharts(); drawTimeline(); }
    requestAnimationFrame(t => frame(t, tok));
  }

  function play(): void {
    if (running) return;
    running = true;
    lastNow = performance.now();
    playBtn.textContent = "Pause";
    playBtn.classList.add("active");
    const tok = ++loopToken;
    requestAnimationFrame(t => frame(t, tok));
  }
  function pause(): void {
    if (running) {
      running = false;
      hopT0.fill(NaN);
      placeDots();
      drawCharts(); drawTimeline();
    }
    playBtn.textContent = "Run";
    playBtn.classList.remove("active");
  }

  const tView = () => Math.max(view, nice(T));

  // ---- charts ----
  function drawCharts(): void {
    chart.replaceChildren();
    const now = hist[hist.length - 1];
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
      const w = now.walk[k], ex = Math.max(0, now.exact[k]);
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
    txt(188, lgY, "exact x(t)");
    svgEl("line", { x1: 300, x2: 330, y1: lgY - 6, y2: lgY - 6, stroke: "#222", "stroke-width": 2.5, "stroke-dasharray": "7 4" }, chart);
    txt(336, lgY, pi ? "long-run π (πQ = 0)" : "π not unique");

    // --- line plot (bottom) ---
    const lx0 = 60, lx1 = 600, ly0 = 300, ly1 = 196;
    const TV = tView();
    const xs = (s: number) => lx0 + (lx1 - lx0) * s / TV;
    const ys = (v: number) => ly0 + (ly1 - ly0) * v;
    for (const v of [0, 1]) {
      svgEl("line", { x1: lx0, x2: lx1, y1: ys(v), y2: ys(v), class: v === 0 ? "axis" : "grid" }, chart);
      txt(lx0 - 8, ys(v) + 6, String(v), { "text-anchor": "end" });
    }
    for (const s of [0, TV / 2, TV]) txt(xs(s), ly0 + 22, String(s), { "text-anchor": "middle" });
    txt((xs(TV / 2) + xs(TV)) / 2, ly0 + 22, tu ? `time (${tu})` : "time", { "text-anchor": "middle", fill: "#777" });
    for (let k = 0; k < n; k++) {
      if (pi) svgEl("line", { x1: lx0, x2: lx1, y1: ys(pi[k]), y2: ys(pi[k]), "stroke-width": 2, "stroke-dasharray": "7 4", style: `stroke:${col(k)}` }, chart);
      const ptsE = hist.map(h => `${xs(h.t).toFixed(1)},${ys(h.exact[k]).toFixed(1)}`).join(" ");
      const ptsW = hist.map(h => `${xs(h.t).toFixed(1)},${ys(h.walk[k]).toFixed(1)}`).join(" ");
      svgEl("polyline", { points: ptsE, fill: "none", "stroke-width": 6, "stroke-opacity": 0.25, "stroke-linejoin": "round", style: `stroke:${col(k)}` }, chart);
      svgEl("polyline", { points: ptsW, fill: "none", "stroke-width": 2.2, "stroke-linejoin": "round", style: `stroke:${col(k)}` }, chart);
    }

    // --- readout ---
    tOut.textContent = `t = ${fmtT(T)}${tu ? " " + tu : ""}`;
    table.replaceChildren();
    const hr = htmlEl("tr", "", "", table);
    htmlEl("th", "", "", hr);
    states.forEach((s, k) => { const th = htmlEl("th", "", s, hr); th.style.color = col(k); });
    const row = (name: string, v: number[] | null) => {
      const tr = htmlEl("tr", "", "", table);
      htmlEl("td", "", name, tr);
      for (let k = 0; k < n; k++) htmlEl("td", "", v ? f3(Math.max(0, v[k])) : "–", tr);
    };
    row("walkers", now.walk);
    row("exact x(t)", now.exact);
    row("long-run π", pi);
  }

  // ---- one walker's state over time (below the diagram) ----
  function drawTimeline(): void {
    gTl.replaceChildren();
    if (!follow) return;
    const y0 = L.top + L.h, lane = 28, x0 = 90, x1 = 485;
    const TV = tView();
    const xs = (s: number) => x0 + (x1 - x0) * Math.min(s, TV) / TV;
    const yl = (k: number) => y0 + 40 + lane * k + lane / 2;
    const tt = svgEl("text", { x: 250, y: y0 + 22, "text-anchor": "middle", "font-size": 18 }, gTl);
    tt.textContent = "the ringed walker: its state over time";
    for (let k = 0; k < n; k++) {
      svgEl("line", { x1: x0, x2: x1, y1: yl(k), y2: yl(k), class: "grid" }, gTl);
      const t = svgEl("text", { x: x0 - 8, y: yl(k) + 6, "text-anchor": "end", "font-size": 18, "font-weight": 700, style: `fill:${col(k)}` }, gTl);
      t.textContent = states[k];
    }
    const ya = y0 + 40 + lane * n + 4;
    svgEl("line", { x1: x0, x2: x1, y1: ya, y2: ya, class: "axis" }, gTl);
    for (const s of [0, TV / 2, TV]) {
      const t = svgEl("text", { x: xs(s), y: ya + 22, "text-anchor": "middle", "font-size": 18 }, gTl);
      t.textContent = String(s);
    }
    // segments: [track[m].t, track[m+1].t) in state track[m].k; the last runs to T
    let path = "";
    for (let m = 0; m < track.length; m++) {
      const a = track[m].t, b = m + 1 < track.length ? track[m + 1].t : T, k = track[m].k;
      if (a > TV) break;
      const xa = xs(a), xb = xs(b);
      svgEl("rect", { x: xa, y: yl(k) - 8, width: Math.max(1.5, xb - xa), height: 16, style: `fill:${col(k)}` }, gTl);
      path += (m === 0 ? `M${xa},${yl(k)}` : `L${xa},${yl(k)}`) + `L${xb},${yl(k)}`;
    }
    svgEl("path", { d: path, fill: "none", stroke: "#222", "stroke-width": 1.2 }, gTl);
  }

  // ---- load a chain ----
  function load(c: CChain): void {
    chain = c;
    n = c.states.length;
    states = c.states.slice();
    R = c.R.map(r => r.slice());
    Q = rateMatrix(R);
    unit = c.unit ?? "";
    tu = unit.replace(/^\//, "");
    view = c.view ?? 10;
    const si = SPEEDS.indexOf(c.speed ?? 1);
    speed = SPEEDS[si >= 0 ? si : 4];
    speedSl.set(si >= 0 ? si : 4);
    speedSl.input.dispatchEvent(new Event("input"));   // refresh the readout (unit may change)
    L = layout(n);
    startMode = Math.min(n - 1, Math.max(0, c.start ?? 0));
    sizeDiagram();
    buildDiagram();
    updateArrows();
    buildEdit();
    buildStart();
    reset();
  }

  chainBtns[0].classList.add("active");
  load(chain);
}

autoMount("ctmcwalkers", mount);
