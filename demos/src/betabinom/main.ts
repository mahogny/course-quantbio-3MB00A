// Beta-binomial updater. Auto-mounts on <div data-demo="betabinom">.
// Prior Beta(a, b) + data k positive of n cells -> posterior Beta(a + k, b + n - k).
// Plots prior, scaled likelihood and posterior on one axis, the posterior mean and 95%
// credible interval, and, for contrast, the frequentist k/n with its 95% (Wald) CI.
// Optional attributes: data-a, data-b (prior), data-k, data-n (data), data-truep (the
// true fraction used by "+10 random cells"), data-seed.
import { svgEl, htmlEl, slider, button, presets, checkbox, scale, rng, autoMount, Slider } from "../lib/ui";
import { betaPdf, betaQuantile, waldCI } from "./math";

const NMAX = 400;

const CSS = `
[data-demo="betabinom"] .bb-plot { flex: 1 1 520px; max-width: 760px; }
[data-demo="betabinom"] .qb-panel { flex: 0 1 330px; }
[data-demo="betabinom"] .bb-row { display: flex; flex-wrap: wrap; gap: .35em; }
[data-demo="betabinom"] .bb-head { font-weight: 600; margin-top: .2em; }
[data-demo="betabinom"] .prior { stroke: var(--qb-c1); }
[data-demo="betabinom"] .lik { stroke: var(--qb-c4); }
[data-demo="betabinom"] .post { stroke: var(--qb-c2); }
.reveal [data-demo="betabinom"] { font-size: 19px; gap: .8em; }
.reveal [data-demo="betabinom"] .bb-plot { flex: 1 1 700px; max-width: 790px; }
.reveal [data-demo="betabinom"] .qb-panel { flex: 0 1 320px; gap: .3em; }
.reveal [data-demo="betabinom"] .qb-slider { grid-template-columns: 1.2em 1fr 2.4em; }
.reveal [data-demo="betabinom"] .qb-readout { font-size: .8em; }
`;

function injectCss(): void {
  if (document.getElementById("bb-css")) return;
  const s = document.createElement("style");
  s.id = "bb-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

function mount(host: HTMLElement): void {
  injectCss();
  const num = (v: string | undefined, d: number) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
  const init = {
    a: num(host.dataset.a, 1), b: num(host.dataset.b, 1),
    k: num(host.dataset.k, 6), n: num(host.dataset.n, 20),
  };
  const trueP = num(host.dataset.truep, 0.3);
  const seed = num(host.dataset.seed, 7);
  const st = { ...init };
  let rand = rng(seed);

  // ---------- plot ----------
  const W = 760, H = 490;
  const L = 60, R = 745, T = 30, B = 290; // density panel
  const x = scale(0, 1, L, R);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "bb-plot", role: "img",
    "aria-label": "Prior, likelihood and posterior for a proportion" });
  const gGrid = svgEl("g", {}, svg);
  for (let i = 0; i <= 10; i++) {
    const xx = x(i / 10);
    svgEl("line", { x1: xx, y1: T, x2: xx, y2: B, class: "grid" }, gGrid);
    if (i % 2 === 0) svgEl("text", { x: xx, y: B + 26, "text-anchor": "middle", "font-size": 21 }, gGrid).textContent = (i / 10).toFixed(1);
  }
  svgEl("line", { x1: L, y1: B, x2: R, y2: B, class: "axis" }, svg);
  svgEl("line", { x1: L, y1: T, x2: L, y2: B, class: "axis" }, svg);
  svgEl("text", { x: (L + R) / 2, y: B + 52, "text-anchor": "middle", "font-size": 21 }, svg)
    .textContent = "p = fraction of marker-positive cells";
  svgEl("text", { x: 34, y: (T + B) / 2, "text-anchor": "middle", "font-size": 21,
    transform: `rotate(-90 34 ${(T + B) / 2})` }, svg).textContent = "density";

  const ciArea = svgEl("path", { fill: "var(--qb-c2)", "fill-opacity": 0.18, stroke: "none" }, svg);
  const priorPath = svgEl("path", { class: "prior", fill: "none", "stroke-width": 3, "stroke-dasharray": "8 5" }, svg);
  const postPath = svgEl("path", { class: "post", fill: "none", "stroke-width": 4 }, svg);
  const likPath = svgEl("path", { class: "lik", fill: "none", "stroke-width": 3.5, "stroke-dasharray": "2 6", "stroke-linecap": "round" }, svg);
  const meanLine = svgEl("line", { stroke: "var(--qb-c2)", "stroke-width": 2, y1: T, y2: B }, svg);
  const truthMark = svgEl("g", {}, svg);
  svgEl("path", { d: "M0,0 l-8,-14 h16 z", fill: "var(--qb-fg)" }, truthMark);
  svgEl("text", { x: 0, y: -18, "text-anchor": "middle", "font-size": 20 }, truthMark).textContent = "true p";

  // legend
  const leg = svgEl("g", { transform: `translate(${R - 265}, ${T + 4})` }, svg);
  const legItems: [string, string, string][] = [
    ["prior", "8 5", "var(--qb-c1)"], ["likelihood (scaled)", "2 4", "var(--qb-c4)"], ["posterior", "", "var(--qb-c2)"]];
  legItems.forEach(([t, dash, col], i) => {
    svgEl("line", { x1: 0, x2: 40, y1: 14 + i * 29, y2: 14 + i * 29, stroke: col, "stroke-width": 3.5,
      "stroke-dasharray": dash, "stroke-linecap": "round" }, leg);
    svgEl("text", { x: 50, y: 21 + i * 29, "font-size": 21 }, leg).textContent = t;
  });

  // interval strips below the axis
  const yBay = 395, yFreq = 465;
  const strip = (yy: number, col: string, label: string) => {
    const g = svgEl("g", {}, svg);
    svgEl("text", { x: L - 30, y: yy - 17, "font-size": 20, fill: col }, g).textContent = label;
    const bar = svgEl("line", { y1: yy, y2: yy, stroke: col, "stroke-width": 5, "stroke-linecap": "round" }, g);
    const lo = svgEl("line", { y1: yy - 9, y2: yy + 9, stroke: col, "stroke-width": 3 }, g);
    const hi = svgEl("line", { y1: yy - 9, y2: yy + 9, stroke: col, "stroke-width": 3 }, g);
    const dot = svgEl("circle", { cy: yy, r: 8, fill: "#fff", stroke: col, "stroke-width": 3 }, g);
    const txt = svgEl("text", { y: yy + 7, "font-size": 20, fill: col }, g);
    return { g, bar, lo, hi, dot, txt, label: g.firstChild as SVGTextElement };
  };
  const sBay = strip(yBay, "var(--qb-c2)", "");
  const sFreq = strip(yFreq, "var(--qb-c5)", "");

  // ---------- controls ----------
  const panel = htmlEl("div", "qb-panel");
  htmlEl("div", "bb-head", "Prior Beta(α, β)", panel);
  const sA = slider(panel, "α", 1, 100, 1, st.a, v => { st.a = v; draw(); });
  const sB = slider(panel, "β", 1, 100, 1, st.b, v => { st.b = v; draw(); });
  htmlEl("div", "bb-head", "Data: k positive of n cells", panel);
  const sN = slider(panel, "n", 0, NMAX, 1, st.n, v => { st.n = v; st.k = Math.min(st.k, v); draw(); });
  const sK: Slider = slider(panel, "k", 0, NMAX, 1, st.k, v => { st.k = Math.min(v, st.n); draw(); });
  const row = htmlEl("div", "bb-row", "", panel);
  const add = (pos: number, neg: number) => {
    const room = NMAX - st.n;
    if (room <= 0) return;
    const tot = Math.min(room, pos + neg);
    st.n += tot; st.k += Math.min(pos, tot);
    draw();
  };
  button(row, "+1 positive", () => add(1, 0));
  button(row, "+1 negative", () => add(0, 1));
  button(row, "+10 random cells", () => {
    let pos = 0;
    for (let i = 0; i < 10; i++) if (rand.unif() < trueP) pos++;
    add(pos, 10 - pos);
  });
  button(row, "no data", () => { st.n = 0; st.k = 0; rand = rng(seed); draw(); });
  let showTruth = false;
  checkbox(panel, `show true p = ${trueP}`, false, v => { showTruth = v; draw(); });
  presets(panel, [
    { label: "6/20 flat", apply: () => set(1, 1, 6, 20) },
    { label: "6/20 Beta(2,8)", apply: () => set(2, 8, 6, 20) },
    { label: "60/200 Beta(2,8)", apply: () => set(2, 8, 60, 200) },
    { label: "6/20 wrong prior", apply: () => set(40, 10, 6, 20) },
    { label: "60/200 wrong prior", apply: () => set(40, 10, 60, 200) },
  ]);
  const readout = htmlEl("div", "qb-readout", "", panel);
  host.append(svg, panel);

  function set(a: number, b: number, k: number, n: number): void {
    Object.assign(st, { a, b, k, n });
    rand = rng(seed);
    draw();
  }

  // ---------- drawing ----------
  const NG = 400;
  const grid = Array.from({ length: NG + 1 }, (_, i) => i / NG);
  const fmt = (v: number) => v.toFixed(2);
  const fmt3 = (v: number) => v.toFixed(3);

  function curve(ys: number[], y: (v: number) => number): string {
    return grid.map((p, i) => `${i ? "L" : "M"}${x(p).toFixed(1)},${y(Math.min(ys[i], 1e6)).toFixed(1)}`).join("");
  }

  function draw(): void {
    // keep the controls in sync (the buttons and presets change the state too)
    sA.set(st.a); sB.set(st.b); sN.set(st.n);
    sK.input.max = String(st.n); sK.set(st.k);
    const pa = st.a + st.k, pb = st.b + st.n - st.k;
    const prior = grid.map(p => betaPdf(p, st.a, st.b));
    const lik = grid.map(p => betaPdf(p, st.k + 1, st.n - st.k + 1)); // likelihood scaled to area 1
    const post = grid.map(p => betaPdf(p, pa, pb));
    const finite = (v: number) => (Number.isFinite(v) ? v : 0);
    const ymax = Math.max(1.2, ...prior.map(finite), ...lik.map(finite), ...post.map(finite)) * 1.12;
    const y = scale(0, ymax, B, T);
    priorPath.setAttribute("d", curve(prior, y));
    likPath.setAttribute("d", curve(lik, y));
    likPath.style.display = st.n > 0 ? "" : "none";
    postPath.setAttribute("d", curve(post, y));

    const mean = pa / (pa + pb);
    const lo = betaQuantile(0.025, pa, pb), hi = betaQuantile(0.975, pa, pb);
    // shaded 95% credible region under the posterior
    const inside = grid.filter(p => p >= lo && p <= hi);
    const pts = [lo, ...inside, hi];
    ciArea.setAttribute("d", `M${x(lo)},${B}` + pts.map(p => `L${x(p).toFixed(1)},${y(betaPdf(p, pa, pb)).toFixed(1)}`).join("") + `L${x(hi)},${B}Z`);
    meanLine.setAttribute("x1", String(x(mean))); meanLine.setAttribute("x2", String(x(mean)));
    truthMark.setAttribute("transform", `translate(${x(trueP)}, ${B})`);
    truthMark.style.display = showTruth ? "" : "none";

    const putStrip = (s: ReturnType<typeof strip>, label: string, est: number | null, l: number, h: number) => {
      s.label.textContent = label;
      const vis = est !== null;
      for (const e of [s.bar, s.lo, s.hi, s.dot]) e.style.display = vis ? "" : "none";
      if (!vis) { s.txt.textContent = "needs data"; s.txt.setAttribute("x", String(x(0.02))); return; }
      s.bar.setAttribute("x1", String(x(l))); s.bar.setAttribute("x2", String(x(h)));
      s.lo.setAttribute("x1", String(x(l))); s.lo.setAttribute("x2", String(x(l)));
      s.hi.setAttribute("x1", String(x(h))); s.hi.setAttribute("x2", String(x(h)));
      s.dot.setAttribute("cx", String(x(est)));
      const right = x(h) + 14 < R - 130;
      s.txt.setAttribute("x", String(right ? x(h) + 14 : x(l) - 14));
      s.txt.setAttribute("text-anchor", right ? "start" : "end");
      s.txt.textContent = `[${fmt(l)}, ${fmt(h)}]`;
    };
    putStrip(sBay, "Bayesian: posterior mean, 95% credible interval", mean, lo, hi);
    const w = waldCI(st.k, st.n);
    putStrip(sFreq, "Frequentist: k/n, 95% confidence interval (± 1.96·SE)", w ? w.est : null, w ? w.lo : 0, w ? w.hi : 0);

    const priorN = st.a + st.b;
    readout.textContent =
      `posterior Beta(${pa}, ${pb})\n` +
      `mean ${fmt3(mean)}  CrI [${fmt(lo)}, ${fmt(hi)}]\n` +
      (w ? `k/n ${fmt3(w.est)}  CI [${fmt(w.lo)}, ${fmt(w.hi)}]\n` : `k/n (no data)\n`) +
      `prior share of counts ${(100 * priorN / (priorN + st.n)).toFixed(0)}%`;
  }
  draw();
}

autoMount("betabinom", mount);
