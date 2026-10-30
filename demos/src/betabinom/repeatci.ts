// data-mode="repeatci": "repeat the experiment 100 times". Each experiment counts k positive
// of n cells at a fixed true rate; each gives a 95% confidence interval k/n ± 1.96·SE (Wald).
// The 100 intervals are stacked as horizontal bars; the ones that miss the true rate are red.
// Optional: overlay the flat-prior 95% credible interval of each experiment for comparison.
import { svgEl, htmlEl, slider, button, presets, checkbox, scale, rng } from "../lib/ui";
import { waldCI, flatCrI, rbinom, coverage } from "./math";

const NEXP = 100;
type Iv = { lo: number; hi: number };

export function mountRepeat(host: HTMLElement, num: (v: string | undefined, d: number) => number): void {
  host.classList.add("bb-repeat");
  const st = {
    p: Math.min(0.99, Math.max(0.01, num(host.dataset.truep, 0.3))),
    n: Math.min(400, Math.max(5, Math.round(num(host.dataset.n, 20)))),
  };
  const seed = num(host.dataset.seed, 7);
  let rand = rng(seed);
  let showBayes = host.dataset.credible === "true";

  // ---------- plot ----------
  const W = 760, H = 500;
  const L = 30, R = 745, T = 50, B = 430, GAP = 44;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "bb-plot", role: "img",
    "aria-label": "100 repeated experiments and their 95% intervals" });
  svgEl("text", { x: (L + R) / 2, y: B + 54, "text-anchor": "middle", "font-size": 21 }, svg)
    .textContent = "fraction of marker-positive cells";

  // One panel of 100 stacked intervals: axis, grid, true-rate line, hit/miss paths, title.
  // Intervals of zero width (k = 0 or k = n gives the single point 0 or 1) get a dot.
  const mkPanel = (hitCol: string, title: string) => {
    const g = svgEl("g", {}, svg);
    const gAx = svgEl("g", {}, g);
    const path = (col: string) => svgEl("path", { fill: "none", stroke: col, "stroke-linecap": "round" }, g);
    const hit = path(hitCol), miss = path("var(--qb-c2)");
    const dots = svgEl("path", { fill: "var(--qb-c2)", stroke: "none" }, g);
    const truth = svgEl("line", { y1: T - 4, y2: B, stroke: "var(--qb-fg)", "stroke-width": 2.5, "stroke-dasharray": "7 4" }, g);
    const head = svgEl("text", { y: T - 26, "font-size": 21, "font-weight": 600, fill: hitCol }, g);
    head.textContent = title;
    const lab = svgEl("text", { y: T - 6, "font-size": 19 }, g);
    return { g, gAx, hit, miss, dots, truth, head, lab };
  };
  const pW = mkPanel("var(--qb-c5)", "confidence intervals");
  const pB = mkPanel("var(--qb-c1)", "credible intervals (flat prior)");

  // ---------- controls ----------
  // ---------- controls ----------
  const panel = htmlEl("div", "qb-panel");
  htmlEl("div", "bb-head", "One experiment: count n cells", panel);
  const sP = slider(panel, "true rate", 0.01, 0.99, 0.01, st.p, v => { st.p = v; restart(); });
  const sN = slider(panel, "n cells", 5, 400, 1, st.n, v => { st.n = v; restart(); });
  for (const s of [sP, sN]) s.input.parentElement!.classList.add("bb-wide");
  button(htmlEl("div", "bb-row", "", panel), `repeat ${NEXP} more experiments`, () => { draw100(); render(); }, "bb-go");
  checkbox(panel, "also show credible intervals (flat prior)", showBayes, v => { showBayes = v; render(); });
  presets(panel, [
    { label: "n 20, rate 0.3", apply: () => set(0.3, 20) },
    { label: "n 200, rate 0.3", apply: () => set(0.3, 200) },
    { label: "n 20, rate 0.05", apply: () => set(0.05, 20) },
    { label: "n 200, rate 0.02", apply: () => set(0.02, 200) },
  ]);
  const big = htmlEl("div", "qb-big", "", panel);
  const readout = htmlEl("div", "qb-readout", "", panel);
  const note = htmlEl("div", "qb-note", "", panel);
  host.append(svg, panel);

  // ---------- state ----------
  let table: { w: Iv; b: Iv }[] = [];   // the two intervals for every possible k, for the current n
  let ks: number[] = [];                // the latest 100 experiments
  let total = 0, wIn = 0, bIn = 0;      // all experiments since the last change
  let longW = 0, longB = 0;             // long-run shares (repeat forever)

  function set(p: number, n: number): void {
    st.p = p; st.n = n; sP.set(p); sN.set(n);
    restart();
  }

  function restart(): void {
    if (table.length !== st.n + 1) {
      table = [];
      for (let k = 0; k <= st.n; k++) {
        const w = waldCI(k, st.n)!;
        table.push({ w: { lo: w.lo, hi: w.hi }, b: flatCrI(k, st.n) });
      }
    }
    longW = coverage(st.n, st.p, k => table[k].w);
    longB = coverage(st.n, st.p, k => table[k].b);
    rand = rng(seed);
    total = wIn = bIn = 0;
    draw100();
    render();
  }

  const inside = (iv: Iv) => iv.lo <= st.p && st.p <= iv.hi;

  function draw100(): void {
    ks = Array.from({ length: NEXP }, () => rbinom(st.n, st.p, rand.unif));
    total += NEXP;
    for (const k of ks) {
      if (inside(table[k].w)) wIn++;
      if (inside(table[k].b)) bIn++;
    }
  }

  function render(): void {
    const rowH = (B - T - 8) / NEXP, sw = rowH * 0.62;
    const mid = (L + R) / 2;
    const layout: [typeof pW, number, number, (k: number) => Iv][] = showBayes
      ? [[pW, L, mid - GAP / 2, k => table[k].w], [pB, mid + GAP / 2, R, k => table[k].b]]
      : [[pW, L, R, k => table[k].w]];
    pB.g.style.display = showBayes ? "" : "none";
    const counts: number[] = [];
    for (const [pn, x0, x1, iv] of layout) {
      const x = scale(0, 1, x0, x1);
      // axis and grid for this panel width
      pn.gAx.replaceChildren();
      for (let i = 0; i <= 10; i++) {
        const xx = x(i / 10);
        svgEl("line", { x1: xx, y1: T, x2: xx, y2: B, class: "grid" }, pn.gAx);
        const step = showBayes ? 5 : 2;
        if (i % step === 0) svgEl("text", { x: xx, y: B + 26, "text-anchor": "middle", "font-size": 21 }, pn.gAx)
          .textContent = (i / 10).toFixed(1);
      }
      svgEl("line", { x1: x0, y1: B, x2: x1, y2: B, class: "axis" }, pn.gAx);
      let dh = "", dm = "", dd = "", nIn = 0;
      ks.forEach((k, i) => {
        const yy = T + 4 + (i + 0.5) * rowH;
        const c = iv(k);
        const sg = `M${x(c.lo).toFixed(1)},${yy.toFixed(1)}H${x(c.hi).toFixed(1)}`;
        if (inside(c)) { nIn++; dh += sg; } else {
          dm += sg;
          if (c.hi - c.lo < 1e-9) { const r = Math.max(2.5, rowH * 0.9); dd += `M${x(c.lo) - r},${yy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`; }
        }
      });
      pn.hit.setAttribute("d", dh); pn.miss.setAttribute("d", dm); pn.dots.setAttribute("d", dd);
      for (const e of [pn.hit, pn.miss]) e.setAttribute("stroke-width", sw.toFixed(2));
      const xt = x(st.p);
      pn.truth.setAttribute("x1", String(xt)); pn.truth.setAttribute("x2", String(xt));
      pn.head.setAttribute("x", String(x0));
      const right = st.p < 0.6;
      pn.lab.setAttribute("x", String(xt + (right ? 6 : -6)));
      pn.lab.setAttribute("text-anchor", right ? "start" : "end");
      pn.lab.textContent = `true rate ${st.p.toFixed(2)}`;
      counts.push(nIn);
    }
    const nW = counts[0], nB = counts[1] ?? 0;
    const zeros = ks.some(k => table[k].w.hi - table[k].w.lo < 1e-9);
    note.textContent = "Each bar is one experiment: k positive of n cells, and its 95% interval. " +
      "Red bars miss the true rate (dashed line)." +
      (zeros ? " A red dot: all cells negative (or all positive), so the confidence interval shrinks to a single point." : "");

    const pc = (v: number) => (100 * v).toFixed(1) + "%";
    big.textContent = `${nW} of ${NEXP} confidence intervals contain the true rate`;
    readout.textContent =
      `confidence intervals\n` +
      ` all so far: ${wIn} of ${total} (${pc(wIn / total)})\n` +
      ` if repeated forever: ${pc(longW)}` +
      (showBayes
        ? `\ncredible intervals\n ${nB} of ${NEXP} contain it\n` +
          ` all so far: ${bIn} of ${total} (${pc(bIn / total)})\n` +
          ` if repeated forever: ${pc(longB)}`
        : "");
  }

  restart();
}
