// Cross-validation leakage on pure noise. n samples x p "genes" of pure noise, random labels.
// Left: "leaky" — pick the top-k genes by |t| on ALL samples, then 5-fold CV.
// Right: "honest" — 5-fold CV with the gene selection redone inside each fold (training rows only).
// Classifier: nearest centroid on the k selected genes. Histograms collect the CV accuracy over
// repeated random datasets, with the 50% chance line.
// Auto-mounts on <div data-demo="leakage">. Optional: data-n="40" data-p="2000" data-k="20" data-seed="7".
import { svgEl, htmlEl, slider, button, scale, autoMount } from "../lib/ui";
import { makeData, cvAccuracy, CvResult } from "./sim";

const NAME = "leakage";
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .6em; }
[data-demo="${NAME}"] .lk-ctrl { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: .3em 1.2em; width: 100%; }
[data-demo="${NAME}"] .lk-row { display: flex; flex-wrap: wrap; gap: .45em; align-items: center; }
[data-demo="${NAME}"] svg { width: 100%; max-width: 1000px; }
[data-demo="${NAME}"] .qb-btn:disabled { opacity: .45; cursor: default; }
.reveal [data-demo="${NAME}"] { font-size: 20px; }
`;

const COL = { leak: "#d62728", honest: "#1f77b4", ok: "#2ca02c", bad: "#d62728", chance: "#444" };

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

interface PanelView {
  acc: SVGTextElement; dots: SVGGElement; bars: SVGGElement; marker: SVGPolygonElement;
  stats: SVGTextElement; yTop: SVGTextElement;
}

function mount(host: HTMLElement): void {
  injectStyle();
  const n0 = Number(host.dataset.n ?? 40), p0 = Number(host.dataset.p ?? 2000), k0 = Number(host.dataset.k ?? 20);
  const seed0 = Number(host.dataset.seed ?? 7);   // a typical first dataset
  const st = { n: n0, p: p0, k: k0, seed: seed0 };
  const hist = { leak: [] as number[], honest: [] as number[] };
  let running = 0;   // id of the running "repeat" batch (0 = none)

  // ---------------- controls ----------------
  const ctrl = htmlEl("div", "lk-ctrl", "", host);
  const sN = slider(ctrl, "samples n", 20, 100, 2, st.n, v => { st.n = v; settingsChanged(); });
  const sP = slider(ctrl, "genes p", 100, 5000, 100, st.p, v => { st.p = v; settingsChanged(); });
  const sK = slider(ctrl, "selected k", 1, 100, 1, st.k, v => { st.k = v; settingsChanged(); });
  const row = htmlEl("div", "lk-row", "", host);
  const bNew = button(row, "New random dataset", () => { stop(); st.seed++; compute(true); });
  const bRep = button(row, "Repeat 50×", () => repeat(50));
  const bClr = button(row, "Clear histograms", () => { stop(); hist.leak = []; hist.honest = []; drawHist(); });
  button(row, "Reset", () => {
    stop(); st.n = n0; st.p = p0; st.k = k0;
    st.seed = seed0; sN.set(n0); sP.set(p0); sK.set(k0); hist.leak = []; hist.honest = []; compute(true);
  });
  const info = htmlEl("span", "qb-note", "", row);

  // ---------------- drawing ----------------
  const W = 1000, H = 470, PW = 455, GAP = 70, X0 = 8;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "Cross-validated accuracy on pure noise: leaky versus honest feature selection" }, host);
  svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "#fff" }, svg);
  const hx = scale(0, 100, 30, PW - 24);
  const HY0 = 430, HY1 = 255;

  function panel(x0: number, title: string, sub: string, col: string): PanelView {
    const g = svgEl("g", { transform: `translate(${x0},0)` }, svg);
    svgEl("rect", { x: 0, y: 0, width: PW, height: 6, fill: col }, g);
    svgEl("text", { x: 0, y: 36, "font-size": 26, "font-weight": 700, fill: col }, g).textContent = title;
    svgEl("text", { x: 0, y: 64, "font-size": 18, fill: "#444" }, g).textContent = sub;
    svgEl("text", { x: 0, y: 112, "font-size": 20 }, g).textContent = "CV accuracy";
    const acc = svgEl("text", { x: 130, y: 114, "font-size": 40, "font-weight": 700, fill: col }, g);
    const dots = svgEl("g", {}, g);
    // histogram frame
    const bars = svgEl("g", {}, g);
    svgEl("line", { x1: hx(0), y1: HY0, x2: hx(100), y2: HY0, class: "axis", "stroke-width": 1.5 }, g);
    for (const v of [0, 25, 50, 75, 100]) {
      svgEl("line", { x1: hx(v), y1: HY0, x2: hx(v), y2: HY0 + 6, class: "axis" }, g);
      svgEl("text", { x: hx(v), y: HY0 + 26, "text-anchor": "middle", "font-size": 17, fill: "#555" }, g).textContent = v + "%";
    }
    svgEl("line", { x1: hx(50), y1: HY1 - 6, x2: hx(50), y2: HY0, stroke: COL.chance, "stroke-width": 2.5, "stroke-dasharray": "7 5" }, g);
    svgEl("text", { x: hx(50) - 6, y: HY1 + 10, "text-anchor": "end", "font-size": 17, fill: COL.chance }, g).textContent = "chance";
    const yTop = svgEl("text", { x: hx(0) - 6, y: HY1 + 6, "text-anchor": "end", "font-size": 15, fill: "#777" }, g);
    const marker = svgEl("polygon", { fill: "#222" }, g);
    const stats = svgEl("text", { x: 0, y: HY1 - 26, "font-size": 18, "font-weight": 600, fill: col }, g);
    return { acc, dots, bars, marker, stats, yTop };
  }
  const vL = panel(X0, "Leaky", "pick top-k genes on ALL samples, then 5-fold CV", COL.leak);
  const vH = panel(X0 + PW + GAP, "Honest", `5-fold CV; pick top-k genes inside each fold`, COL.honest);
  svgEl("line", { x1: X0 + PW + GAP / 2, y1: 10, x2: X0 + PW + GAP / 2, y2: H - 10, stroke: "#ddd", "stroke-width": 2 }, svg);

  let cur: { leak: CvResult; honest: CvResult } | null = null;

  function compute(addToHist: boolean): void {
    const d = makeData(st.n, st.p, st.seed);
    cur = { leak: cvAccuracy(d, st.k, true), honest: cvAccuracy(d, st.k, false) };
    if (addToHist) { hist.leak.push(cur.leak.acc); hist.honest.push(cur.honest.acc); }
    drawCurrent(); drawHist();
  }

  function drawDots(v: PanelView, res: CvResult): void {
    v.dots.innerHTML = "";
    const perRow = 40, sp = Math.min(11.2, (PW - 12) / perRow);
    res.correct.forEach((ok, i) => {
      const cx = 6 + (i % perRow) * sp, cy = 140 + Math.floor(i / perRow) * 14;
      svgEl("circle", { cx, cy, r: 4.6, fill: ok ? COL.ok : "#fff", stroke: ok ? COL.ok : COL.bad, "stroke-width": 1.8 }, v.dots);
    });
    const rows = Math.ceil(res.correct.length / perRow);
    const y = 140 + rows * 14 + 12;
    const nOk = res.correct.filter(Boolean).length;
    svgEl("text", { x: 0, y, "font-size": 17, fill: "#555" }, v.dots).textContent =
      `${nOk} of ${res.correct.length} held-out samples right (● right, ○ wrong)`;
  }

  function drawCurrent(): void {
    if (!cur) return;
    vL.acc.textContent = (100 * cur.leak.acc).toFixed(1) + "%";
    vH.acc.textContent = (100 * cur.honest.acc).toFixed(1) + "%";
    drawDots(vL, cur.leak); drawDots(vH, cur.honest);
    info.textContent = `dataset #${st.seed - seed0 + 1} · pure noise: no gene is related to the label`;
  }

  function drawHist(): void {
    const bw = 2.5, nb = 100 / bw;
    const count = (a: number[]) => {
      const c = new Array<number>(nb).fill(0);
      for (const v of a) c[Math.min(nb - 1, Math.floor(v * 100 / bw + 1e-9))]++;
      return c;
    };
    const cL = count(hist.leak), cH = count(hist.honest);
    const top = Math.max(4, ...cL, ...cH);
    const hy = scale(0, top, HY0, HY1);
    for (const [v, c, a, res, col] of [[vL, cL, hist.leak, cur?.leak, COL.leak], [vH, cH, hist.honest, cur?.honest, COL.honest]] as
      [PanelView, number[], number[], CvResult | undefined, string][]) {
      v.bars.innerHTML = "";
      c.forEach((m, i) => {
        if (!m) return;
        svgEl("rect", { x: hx(i * bw) + 1, y: hy(m), width: hx(bw) - hx(0) - 2, height: HY0 - hy(m), fill: col, "fill-opacity": 0.7 }, v.bars);
      });
      v.yTop.textContent = String(top);
      if (a.length) {
        const mean = a.reduce((s, x) => s + x, 0) / a.length;
        v.stats.textContent = `${a.length} noise dataset${a.length > 1 ? "s" : ""} so far: mean ${(100 * mean).toFixed(0)}%`;
      } else v.stats.textContent = "";
      if (res) {
        const x = hx(Math.min(99.9, res.acc * 100));
        v.marker.setAttribute("points", `${x},${HY0 + 2} ${x - 8},${HY0 + 14} ${x + 8},${HY0 + 14}`);
      }
    }
  }

  function settingsChanged(): void {
    stop(); hist.leak = []; hist.honest = [];
    compute(true);
  }

  function stop(): void { running = 0; setBusy(false); }
  function setBusy(b: boolean): void { bRep.disabled = b; bNew.disabled = b; bClr.disabled = b; }

  function repeat(times: number): void {
    stop();
    const id = Date.now();
    running = id;
    setBusy(true);
    let left = times;
    const perFrame = Math.max(1, Math.round(150000 / (st.n * st.p)));
    const tick = () => {
      if (running !== id) return;
      for (let i = 0; i < perFrame && left > 0; i++, left--) { st.seed++; compute(true); }
      if (left > 0) setTimeout(tick, 15); else stop();
    };
    setTimeout(tick, 0);
  }

  compute(true);
}

autoMount(NAME, mount);
