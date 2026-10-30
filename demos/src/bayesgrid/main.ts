// Bayes' rule on a handful of discrete hypotheses, step by step:
//   1 prior  ->  2 likelihood  ->  3 prior × likelihood  ->  4 posterior (= 3 ÷ total).
// Each step is a small bar chart with the numbers printed on the bars, so a by-hand table can
// be checked bar by bar; "show the arithmetic" lists the same numbers as a table.
// Prior bars can be dragged (the others rescale so the prior still sums to 1).
//
// Auto-mounts on <div data-demo="bayesgrid">. data-* options (all optional):
//   data-model="binomial" | "poisson" | "given"     how the likelihood is obtained
//       binomial: k positives out of n; buttons add a positive / a negative (as dbinom)
//       poisson:  observed counts typed in; likelihood = product of dpois(count, rate)
//       given:    likelihood values listed in data-like (e.g. to mirror an exercise table)
//   data-hyp="0.1 0.2 0.3"     hypothesis values (a chance for binomial, a rate for poisson)
//   data-labels="b=0 b=1 b=2"  bar labels (space-separated; use "|" to separate labels with spaces)
//   data-what="infection rate" what a hypothesis is; shown above the bars
//   data-prior="0.5 0.3 0.2"   starting prior (rescaled to sum 1); default flat
//   data-like="0.082 1 0.082"  likelihoods for model "given"
//   data-k="2" data-n="5"      starting data for binomial
//   data-counts="3 5"          starting counts for poisson
//   data-step="1".."4"         how many steps are shown at the start (default 4)
//   data-arith="on"            start with the arithmetic table shown
//   data-scale="on"            start with the likelihood rescaled so its largest value is 1
// Nothing is random: the same attributes always give the same picture.
import { svgEl, htmlEl, button, checkbox, svgPoint, draggable, numList, autoMount } from "../lib/ui";
import { binomLike, poissonLike, bayesUpdate, normalise, setOne, fmt } from "./math";

const NAME = "bayesgrid";
const NMAX = 200;
const COL = ["var(--qb-c1)", "var(--qb-c4)", "var(--qb-c5)", "var(--qb-c2)"];
const TITLES = ["1 · prior", "2 · likelihood", "3 · prior × likelihood", "4 · posterior"];

const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .5em; }
[data-demo="${NAME}"] .bg-what { font-size: .9em; color: var(--qb-muted); }
[data-demo="${NAME}"] .bg-panels { display: flex; flex-wrap: wrap; gap: 10px; width: 100%; }
[data-demo="${NAME}"] .bg-panel { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column;
  border: 1px solid var(--qb-grid); border-radius: 8px; padding: 3px 5px 2px; transition: opacity .2s; }
[data-demo="${NAME}"] .bg-panel.off { visibility: hidden; }
[data-demo="${NAME}"] .bg-title { font-weight: 600; line-height: 1.2; }
[data-demo="${NAME}"] .bg-sub { font-size: .8em; color: var(--qb-muted); line-height: 1.2; min-height: 1.2em; }
[data-demo="${NAME}"] .bg-panel svg { width: 100%; height: auto; }
[data-demo="${NAME}"] .bg-controls { display: flex; flex-wrap: wrap; gap: .4em 1.2em; align-items: center; }
[data-demo="${NAME}"] .bg-group { display: flex; flex-wrap: wrap; gap: .35em; align-items: center; }
[data-demo="${NAME}"] .bg-data { font-family: ui-monospace, monospace; font-size: .9em; }
[data-demo="${NAME}"] .bg-counts { font: inherit; font-family: ui-monospace, monospace; width: 9em; padding: .15em .3em; }
[data-demo="${NAME}"] .bg-warn { color: var(--qb-c2); font-size: .85em; }
[data-demo="${NAME}"] .bg-tablewrap { max-width: 100%; overflow-x: auto; }
[data-demo="${NAME}"] table.bg-table { border-collapse: collapse; font-family: ui-monospace, monospace;
  font-size: .85em; margin: 0; }
[data-demo="${NAME}"] .bg-table th, [data-demo="${NAME}"] .bg-table td { padding: .1em .55em; text-align: right;
  border-bottom: 1px solid var(--qb-grid); white-space: nowrap; }
[data-demo="${NAME}"] .bg-table th { font-family: system-ui, sans-serif; font-weight: 600; }
[data-demo="${NAME}"] .bg-table th:first-child, [data-demo="${NAME}"] .bg-table td:first-child { text-align: left; }
[data-demo="${NAME}"] .bg-table tr.tot td { border-bottom: none; font-weight: 600; }
[data-demo="${NAME}"] .bg-table .op { color: var(--qb-muted); padding: 0 .1em; }
.reveal [data-demo="${NAME}"] { font-size: 20px; gap: .35em; }
.reveal [data-demo="${NAME}"] .bg-panel { flex-basis: 220px; }
.reveal [data-demo="${NAME}"] .bg-table { font-size: .8em; }
`;

function injectCss(): void {
  if (document.getElementById("bg-css")) return;
  const s = document.createElement("style");
  s.id = "bg-css";
  s.textContent = STYLE;
  document.head.appendChild(s);
}

type Model = "binomial" | "poisson" | "given";

function mount(host: HTMLElement): void {
  injectCss();
  const ds = host.dataset;
  const on = (v: string | undefined) => v !== undefined && /^(on|1|true|yes)$/i.test(v);
  const int = (v: string | undefined, d: number) => (v !== undefined && /^\s*\d+\s*$/.test(v) ? Number(v) : d);
  const model: Model = ds.model === "poisson" || ds.model === "given" ? ds.model : "binomial";

  // ---------- hypotheses ----------
  const defHyp = model === "poisson" ? [2, 4, 6] : model === "given" ? [1, 2, 3] : [0.1, 0.2, 0.3, 0.4, 0.5];
  let hyp = numList(ds.hyp, defHyp);
  if (model === "binomial") hyp = hyp.map(p => Math.min(1, Math.max(0, p)));
  if (model === "poisson") hyp = hyp.map(r => Math.max(0, r));
  let labels: string[] = [];
  if (ds.labels) labels = (ds.labels.includes("|") ? ds.labels.split("|") : ds.labels.trim().split(/\s+/)).map(s => s.trim());
  const m = Math.max(1, model === "given" && !ds.hyp ? Math.max(labels.length, numList(ds.like, [1, 1, 1]).length) : hyp.length);
  if (hyp.length < m) hyp = Array.from({ length: m }, (_, i) => hyp[i] ?? i + 1);
  hyp = hyp.slice(0, m);
  for (let i = 0; i < m; i++) if (!labels[i]) labels[i] = String(hyp[i]);
  labels = labels.slice(0, m);

  const fit = (v: number[], fill: number) => Array.from({ length: m }, (_, i) => (Number.isFinite(v[i]) && v[i] >= 0 ? v[i] : fill));
  const initPrior = normalise(fit(numList(ds.prior, []), 1));
  const givenLike = fit(numList(ds.like, []), 1);
  const initN = Math.min(NMAX, int(ds.n, 0));
  const initK = Math.min(initN, int(ds.k, 0));
  const parseCounts = (s: string) => s.trim() === "" ? [] : s.trim().split(/[\s,]+/).map(Number);
  const initCounts = parseCounts(ds.counts ?? "").filter(c => Number.isInteger(c) && c >= 0);
  const initStep = Math.min(4, Math.max(1, int(ds.step, 4)));

  const st = {
    prior: initPrior.slice(), k: initK, n: initN, counts: initCounts.slice(),
    step: initStep, arith: on(ds.arith), rescale: on(ds.scale), badCounts: false,
  };

  // ---------- layout ----------
  if (ds.what) htmlEl("div", "bg-what", `Hypotheses: ${ds.what}`, host);
  const panelsDiv = htmlEl("div", "bg-panels", "", host);
  const W = 260, H = 236, T = 30, B = 196, LX = 8, RX = W - 8;
  const slot = (RX - LX) / m, bw = Math.min(64, slot * 0.66);
  const cx = (i: number) => LX + slot * (i + 0.5);
  const fs = m <= 3 ? 19 : m === 4 ? 18 : m === 5 ? 16 : m === 6 ? 14 : 12;

  interface Panel { div: HTMLDivElement; sub: HTMLDivElement; svg: SVGSVGElement; bars: SVGRectElement[];
    nums: SVGTextElement[]; msg: SVGTextElement }
  const panels: Panel[] = TITLES.map((t, p) => {
    const div = htmlEl("div", "bg-panel", "", panelsDiv);
    htmlEl("div", "bg-title", t, div).style.color = COL[p];
    const sub = htmlEl("div", "bg-sub", "", div);
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t }, div);
    svgEl("line", { x1: LX, x2: RX, y1: B, y2: B, class: "axis" }, svg);
    const bars: SVGRectElement[] = [], nums: SVGTextElement[] = [];
    for (let i = 0; i < m; i++) {
      bars.push(svgEl("rect", { x: cx(i) - bw / 2, width: bw, y: B, height: 0, fill: COL[p], rx: 2 }, svg));
      nums.push(svgEl("text", { x: cx(i), y: B - 6, "text-anchor": "middle", "font-size": fs }, svg));
      svgEl("text", { x: cx(i), y: B + 26, "text-anchor": "middle", "font-size": fs }, svg).textContent = labels[i];
    }
    const msg = svgEl("text", { x: W / 2, y: (T + B) / 2, "text-anchor": "middle", "font-size": 17 }, svg);
    return { div, sub, svg, bars, nums, msg };
  });

  // drag the prior: invisible full-height targets over each column
  const priorSvg = panels[0].svg;
  const snap = (y: number) => Math.round(Math.min(1, Math.max(0, (B - y) / (B - T))) * 100) / 100;
  for (let i = 0; i < m; i++) {
    const hit = svgEl("rect", { x: LX + slot * i, width: slot, y: 0, height: B + 4, fill: "transparent" }, priorSvg);
    const setTo = (y: number) => { st.prior = setOne(st.prior, i, snap(y)); draw(); };
    hit.addEventListener("pointerdown", ev => setTo(svgPoint(priorSvg, ev)[1]));
    draggable(hit, ev => svgPoint(priorSvg, ev), (_x, y) => setTo(y));
  }

  // ---------- controls ----------
  const ctr = htmlEl("div", "bg-controls", "", host);
  const gPrior = htmlEl("div", "bg-group", "", ctr);
  button(gPrior, "flat prior", () => { st.prior = st.prior.map(() => 1 / m); draw(); });

  const gData = htmlEl("div", "bg-group", "", ctr);
  const dataTxt = htmlEl("span", "bg-data", "", gData);
  let countsInput: HTMLInputElement | null = null;
  if (model === "binomial") {
    button(gData, "+ positive", () => { if (st.n < NMAX) { st.k++; st.n++; draw(); } });
    button(gData, "+ negative", () => { if (st.n < NMAX) { st.n++; draw(); } });
    button(gData, "clear data", () => { st.k = 0; st.n = 0; draw(); });
  } else if (model === "poisson") {
    const lab = htmlEl("label", "", "observed counts: ", gData);
    countsInput = htmlEl("input", "bg-counts", "", lab);
    countsInput.type = "text";
    countsInput.value = st.counts.join(" ");
    countsInput.setAttribute("aria-label", "observed counts, separated by spaces");
    countsInput.addEventListener("input", () => {
      const v = parseCounts(countsInput!.value);
      st.badCounts = v.some(c => !(Number.isInteger(c) && c >= 0));
      st.counts = v.filter(c => Number.isInteger(c) && c >= 0);
      draw();
    });
    countsInput.addEventListener("change", () => countsInput!.blur());
    countsInput.addEventListener("keydown", ev => { if (ev.key === "Enter") countsInput!.blur(); });
  }
  const warn = htmlEl("span", "bg-warn", "", gData);

  const gStep = htmlEl("div", "bg-group", "", ctr);
  const stepBtn = button(gStep, "", () => { st.step = st.step < 4 ? st.step + 1 : 1; draw(); });
  if (model !== "given") {
    button(gStep, "posterior → new prior", () => {
      const u = bayesUpdate(st.prior, likes());
      if (!u.post) return;
      st.prior = u.post; st.k = 0; st.n = 0; st.counts = [];
      if (countsInput) countsInput.value = "";
      draw();
    });
  }
  button(gStep, "reset", () => {
    Object.assign(st, { prior: initPrior.slice(), k: initK, n: initN, counts: initCounts.slice(), step: initStep, badCounts: false });
    if (countsInput) countsInput.value = st.counts.join(" ");
    draw();
  });

  const gOpt = htmlEl("div", "bg-group", "", ctr);
  checkbox(gOpt, "show the arithmetic", st.arith, v => { st.arith = v; draw(); });
  if (model !== "given") checkbox(gOpt, "scale likelihood so the largest is 1", st.rescale, v => { st.rescale = v; draw(); });

  const tableWrap = htmlEl("div", "bg-tablewrap", "", host);
  const table = htmlEl("table", "bg-table", "", tableWrap);

  // ---------- computing ----------
  function likes(): number[] {
    let L: number[];
    if (model === "given") L = givenLike.slice();
    else if (model === "binomial") L = hyp.map(p => binomLike(st.k, st.n, p));
    else L = hyp.map(r => poissonLike(st.counts, r));
    if (st.rescale && model !== "given") {
      const mx = Math.max(...L);
      if (mx > 0) L = L.map(v => v / mx);
    }
    return L;
  }

  // ---------- drawing ----------
  function bars(p: number, vals: number[] | null, top: number): void {
    const P = panels[p];
    P.msg.textContent = "";
    for (let i = 0; i < m; i++) {
      const v = vals ? vals[i] : 0;
      const h = top > 0 ? (B - T) * Math.min(1, v / top) : 0;
      P.bars[i].setAttribute("y", String(B - h));
      P.bars[i].setAttribute("height", String(h));
      P.nums[i].setAttribute("y", String(B - h - 6));
      P.nums[i].textContent = vals ? fmt(v) : "";
    }
  }

  function draw(): void {
    const L = likes();
    const u = bayesUpdate(st.prior, L);

    // data line
    if (model === "binomial") dataTxt.textContent = `data: ${st.k} positive${st.k === 1 ? "" : "s"} out of ${st.n}`;
    else if (model === "poisson") dataTxt.textContent = "";
    else dataTxt.textContent = "likelihoods given";
    warn.textContent = st.badCounts ? "whole numbers ≥ 0 only" : "";

    // panels
    bars(0, st.prior, 1);
    panels[0].sub.textContent = "drag a bar · sums to 1";
    const maxL = Math.max(...L);
    bars(1, L, maxL);
    panels[1].sub.textContent = model === "given" ? "how well each fits the data"
      : model === "binomial" ? (st.n === 0 ? "no data yet: all equal" : `chance of ${st.k} of ${st.n}`)
      : (st.counts.length === 0 ? "no counts yet: all equal" : `chance of the counts`);
    const maxP = Math.max(...u.prod);
    bars(2, u.prod, maxP);
    panels[2].sub.textContent = `total = ${fmt(u.total)}`;
    if (u.post) { bars(3, u.post, 1); panels[3].sub.textContent = "= step 3 ÷ total · sums to 1"; }
    else {
      bars(3, null, 1);
      panels[3].msg.textContent = "every product is 0";
      panels[3].sub.textContent = "cannot divide by a total of 0";
    }
    panels.forEach((P, p) => P.div.classList.toggle("off", p >= st.step));
    stepBtn.textContent = st.step < 4 ? `next step ▸ ${TITLES[st.step].slice(4)}` : "step by step";

    // arithmetic table
    tableWrap.style.display = st.arith ? "" : "none";
    if (st.arith) {
      const s = st.step;
      const c = (p: number, txt: string) => (s > p ? txt : "");
      const rows: string[] = [];
      rows.push(`<tr><th>hypothesis</th><th>prior</th><th></th><th>${c(1, "likelihood")}</th><th></th>` +
        `<th>${c(2, "prior × likelihood")}</th><th></th><th>${c(3, "posterior")}</th></tr>`);
      for (let i = 0; i < m; i++) {
        rows.push(`<tr><td>${esc(labels[i])}</td><td>${fmt(st.prior[i])}</td><td class="op">${c(1, "×")}</td>` +
          `<td>${c(1, fmt(L[i]))}</td><td class="op">${c(2, "=")}</td><td>${c(2, fmt(u.prod[i]))}</td>` +
          `<td class="op">${c(3, "→")}</td><td>${c(3, u.post ? `${fmt(u.prod[i])} ÷ ${fmt(u.total)} = ${fmt(u.post[i])}` : "–")}</td></tr>`);
      }
      rows.push(`<tr class="tot"><td>total</td><td>${fmt(sum(st.prior))}</td><td></td><td></td><td></td>` +
        `<td>${c(2, fmt(u.total))}</td><td></td><td>${c(3, u.post ? fmt(sum(u.post)) : "–")}</td></tr>`);
      table.innerHTML = rows.join("");
    }
  }
  draw();
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

autoMount(NAME, mount);
