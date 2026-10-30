// Pseudoreplication: measurements within one patient are not independent samples.
// Simulates many studies of control vs treated (by default with no real difference), each
// with P patients per group and M cells per patient; the ICC sets how much of the variation
// is between patients. Each study is analysed twice:
//   "every cell as a sample"    — t-test on all cells (pseudoreplication),
//   "average per patient first" — t-test on the patient means (≈ a mixed model here, since
//                                 every patient has the same number of cells).
// Shows one study as dots coloured by patient, the % of studies called significant by each
// analysis, and the effective number of samples 2PM / (1 + (M − 1)·ICC).
// A "fixed budget" switch keeps patients × cells per group constant (exercise B7), and a
// "true difference" slider turns false alarms into power.
//
// Auto-mounts on <div data-demo="pseudorep">. data-* options (all optional):
//   data-icc="0.2"       ICC, 0–0.9
//   data-patients="3"    patients per group, 2–20
//   data-cells="20"      cells (measurements) per patient, 1–100
//   data-budget="20"     cells per group for the fixed-budget switch (B7: 40 assays = 20 per group)
//   data-effect="0"      true difference in units of the total SD, 0–1
//   data-studies="1000"  number of simulated studies (100–5000)
//   data-seed="1"
import { svgEl, htmlEl, slider, button, checkbox, presets, scale, autoMount } from "../lib/ui";
import { run, effectiveN, Params, Summary } from "./sim";

const NAME = "pseudorep";
const STYLE = `
[data-demo="${NAME}"] .qb-plot { flex: 1 1 420px; max-width: 660px; height: auto; }
[data-demo="${NAME}"] .qb-panel { flex: 0 1 360px; gap: .45em; }
[data-demo="${NAME}"] svg text { font-size: 18px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 16px; fill: #555; }
[data-demo="${NAME}"] .pr-btns { display: flex; gap: .35em; flex-wrap: wrap; }
[data-demo="${NAME}"] .pr-line { display: flex; justify-content: space-between; gap: .6em; }
[data-demo="${NAME}"] .qb-note { margin: 0; }
.qb-demo[data-demo="${NAME}"] .pr-hidden { display: none; }
.reveal [data-demo="${NAME}"] { font-size: 20px; flex-wrap: nowrap; }
.reveal [data-demo="${NAME}"] .qb-plot { flex: 1 1 600px; max-width: 640px; max-height: 540px; }
.reveal [data-demo="${NAME}"] .qb-panel { flex: 0 1 390px; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 16px; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1.1em; height: 1.1em; }
@media (max-width: 640px) { .reveal [data-demo="${NAME}"] { flex-wrap: wrap; } }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (s: string | undefined, d: number) => { const v = Number(s); return s !== undefined && s !== "" && Number.isFinite(v) ? v : d; };
const pct = (f: number) => `${(100 * f).toFixed(f < 0.1 ? 1 : 0)}%`;
const fmtP = (p: number) => p < 0.001 ? "p < 0.001" : `p = ${p < 0.01 ? p.toFixed(3) : p.toFixed(2)}`;
const patientColor = (i: number) => `hsl(${(i * 137.508 + 200) % 360}, 62%, 44%)`;
const COL = { naive: "var(--qb-c2)", pp: "var(--qb-c1)" };

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const init: Params = {
    icc: clamp(num(ds.icc, 0.2), 0, 0.9),
    P: Math.round(clamp(num(ds.patients, 3), 2, 20)),
    M: Math.round(clamp(num(ds.cells, 20), 1, 100)),
    effect: clamp(num(ds.effect, 0), 0, 1),
  };
  const budget = Math.round(clamp(num(ds.budget, 20), 4, 400));
  const NS = Math.round(clamp(num(ds.studies, 1000), 100, 5000));
  const seed0 = Math.round(num(ds.seed, 1));
  // fixed-budget designs: P × M = budget per group, P ≥ 2, M ≤ 100, P ≤ 20
  const designs: [number, number][] = [];
  for (let P = 2; P <= Math.min(20, budget); P++)
    if (budget % P === 0 && budget / P <= 100) designs.push([P, budget / P]);

  const st = { ...init, seed: seed0, fixed: false };
  let res: Summary;

  // ---------------- plot ----------------
  const W = 640, H = 532;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "One simulated study, and the share of simulated studies called significant by each analysis" });
  host.appendChild(svg);

  // ---------------- panel ----------------
  const panel = htmlEl("div", "qb-panel", "", host);
  const sIcc = slider(panel, "ICC", 0, 0.9, 0.05, st.icc, v => { st.icc = v; schedule(); });
  const sP = slider(panel, "patients per group", 2, 20, 1, st.P, v => { st.P = v; schedule(); });
  const sM = slider(panel, "cells per patient", 1, 100, 1, st.M, v => { st.M = v; schedule(); });
  const cb = checkbox(panel, `fixed budget: ${budget} cells per group`, false, v => setFixed(v));
  if (!designs.length) (cb.parentElement as HTMLElement).classList.add("pr-hidden");
  const budgetRow = htmlEl("div", "pr-hidden", "", panel);
  const dBtns = presets(budgetRow, designs.map(([P, M]) => ({
    label: `${P} × ${M}`, apply: () => { st.P = P; st.M = M; schedule(); } })));
  htmlEl("p", "qb-note", "patients × cells, per group", budgetRow);
  const sE = slider(panel, "true difference", 0, 1, 0.1, st.effect, v => { st.effect = v; schedule(); });
  const btns = htmlEl("div", "pr-btns", "", panel);
  button(btns, `new ${NS} studies`, () => { st.seed++; schedule(); });
  button(btns, "reset", () => {
    Object.assign(st, init, { seed: seed0 });
    sIcc.set(st.icc); sP.set(st.P); sM.set(st.M); sE.set(st.effect);
    cb.checked = false; setFixed(false);
  });
  const readout = htmlEl("div", "qb-readout", "", panel);
  const note = htmlEl("p", "qb-note", "", panel);

  function setFixed(on: boolean): void {
    st.fixed = on;
    for (const s of [sP, sM]) (s.input.parentElement as HTMLElement).classList.toggle("pr-hidden", on);
    budgetRow.classList.toggle("pr-hidden", !on);
    if (on) {
      // pick the budget design closest to the current number of patients
      let k = 0;
      designs.forEach(([P], i) => { if (Math.abs(P - st.P) < Math.abs(designs[k][0] - st.P)) k = i; });
      [st.P, st.M] = designs[k];
      dBtns.forEach((b, i) => b.classList.toggle("active", i === k));
    } else { sP.set(st.P); sM.set(st.M); }
    schedule();
  }

  let pending = false;
  function schedule(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; res = run(st, NS, st.seed); draw(); });
  }

  // ---------------- drawing ----------------
  const L = 52, R = W - 12;
  const sT = 62, sB = 282;           // study picture
  const bT = 384, bRow = 60;         // bars

  function draw(): void {
    svg.replaceChildren();
    const { P, M, effect } = st;
    const study = res.example;

    // --- one study ---
    svgEl("text", { x: 8, y: 22, class: "ttl" }, svg).textContent = `One of the ${NS} studies: ${2 * P} patients, ${2 * P * M} cells`;
    const pLine = svgEl("text", { x: 8, y: 48, class: "sm" }, svg);
    const part = (s: string, col = "", bold = false) => {
      const t = svgEl("tspan", {}, pLine); t.textContent = s;
      if (col) t.style.fill = col;
      if (bold) t.style.fontWeight = "700";
    };
    part("every cell: "); part(fmtP(res.exampleP.naive), COL.naive, res.exampleP.naive < 0.05);
    part("per patient: "); (pLine.lastChild as SVGTSpanElement).setAttribute("dx", "28"); part(fmtP(res.exampleP.perPatient), COL.pp, res.exampleP.perPatient < 0.05);

    const lo = -3.2, hi = 3.2 + effect;
    const y = scale(lo, hi, sB, sT);
    const ncol = 2 * P + 1;
    const cw = (R - L) / ncol;
    const colX = (g: number, i: number) => L + cw * (g * (P + 1) + i + 0.5);
    svgEl("line", { x1: L, x2: R, y1: y(0), y2: y(0), class: "grid" }, svg);
    svgEl("line", { x1: L, x2: L, y1: sT, y2: sB, class: "axis" }, svg);
    const yl = svgEl("text", { x: 20, y: (sT + sB) / 2, "text-anchor": "middle", transform: `rotate(-90 20 ${(sT + sB) / 2})`, class: "sm" }, svg);
    yl.textContent = "biomarker";
    const r = M > 40 ? 2.3 : M > 15 ? 3 : 4;
    let jit = 12345;
    const jitter = () => { jit = (jit * 1103515245 + 12345) % 2147483648; return jit / 2147483648 - 0.5; };
    for (let g = 0; g < 2; g++) {
      const gm: number[] = [];
      const dots = svgEl("g", { "fill-opacity": 0.7 }, svg);
      for (let i = 0; i < P; i++) {
        const cells = study[g][i], cx = colX(g, i), col = patientColor(g * P + i);
        for (const v of cells)
          svgEl("circle", { cx: (cx + jitter() * cw * 0.6).toFixed(1), cy: y(clamp(v, lo, hi)).toFixed(1), r, fill: col }, dots);
        const m = cells.reduce((a, b) => a + b, 0) / cells.length;
        gm.push(m);
        svgEl("line", { x1: cx - cw * 0.42, x2: cx + cw * 0.42, y1: y(m), y2: y(m), stroke: "var(--qb-fg)", "stroke-width": 3 }, svg);
      }
      const gmean = gm.reduce((a, b) => a + b, 0) / P;
      const x0 = colX(g, 0) - cw / 2, x1 = colX(g, P - 1) + cw / 2;
      svgEl("line", { x1: x0, x2: x1, y1: y(gmean), y2: y(gmean), stroke: "var(--qb-axis)", "stroke-width": 2, "stroke-dasharray": "7 5" }, svg);
      svgEl("text", { x: (x0 + x1) / 2, y: sB + 24, "text-anchor": "middle", "font-weight": 600 }, svg).textContent = g ? "treated" : "control";
    }
    const lg = svgEl("g", { class: "sm" }, svg);
    svgEl("line", { x1: L + 4, x2: L + 28, y1: sB + 46, y2: sB + 46, stroke: "var(--qb-fg)", "stroke-width": 3 }, lg);
    svgEl("text", { x: L + 34, y: sB + 51, class: "sm" }, lg).textContent = "patient average";
    svgEl("line", { x1: L + 190, x2: L + 214, y1: sB + 46, y2: sB + 46, stroke: "var(--qb-axis)", "stroke-width": 2, "stroke-dasharray": "7 5" }, lg);
    svgEl("text", { x: L + 220, y: sB + 51, class: "sm" }, lg).textContent = "group average";
    svgEl("text", { x: R, y: sB + 51, class: "sm", "text-anchor": "end" }, lg).textContent = "one colour = one patient";

    // --- bars ---
    const ttl = effect > 0 ? `All ${NS} studies (real difference): % that found it` : `All ${NS} studies (no real difference): % called significant`;
    svgEl("text", { x: 8, y: bT - 6, class: "ttl" }, svg).textContent = ttl;
    const bx = scale(0, 1, L, R - 70);
    const rows: [string, number, string][] = [
      ["every cell as a sample", res.naive, COL.naive],
      ["average per patient first (≈ mixed model)", res.perPatient, COL.pp],
    ];
    rows.forEach(([lab, f, col], k) => {
      const y0 = bT + 26 + k * bRow;
      svgEl("text", { x: L, y: y0 }, svg).textContent = lab;
      svgEl("rect", { x: L, y: y0 + 8, width: bx(1) - L, height: 24, fill: "var(--qb-grid)" }, svg);
      svgEl("rect", { x: L, y: y0 + 8, width: Math.max(0, bx(f) - L), height: 24, fill: col, "fill-opacity": 0.85 }, svg);
      svgEl("text", { x: bx(1) + 8, y: y0 + 27, "font-weight": 700 }, svg).textContent = pct(f);
    });
    const x5 = bx(0.05), yb = bT + 26 + bRow + 36;
    svgEl("line", { x1: x5, x2: x5, y1: bT + 28, y2: yb, stroke: "var(--qb-fg)", "stroke-width": 2, "stroke-dasharray": "4 3" }, svg);
    svgEl("text", { x: x5, y: yb + 18, "text-anchor": "middle", class: "sm" }, svg).textContent = "5%";
    svgEl("text", { x: bx(1), y: yb + 18, "text-anchor": "end", class: "sm" }, svg).textContent = "100%";

    // --- readout ---
    readout.replaceChildren();
    const line = (a: string, b: string, bold = false) => {
      const d = htmlEl("div", "pr-line", "", readout);
      if (bold) d.style.fontWeight = "700";
      htmlEl("span", "", a, d); htmlEl("span", "", b, d);
    };
    const nEff = effectiveN(st);
    line("cells measured", String(2 * P * M));
    line("patients", String(2 * P));
    line("effective samples", `≈ ${nEff >= 10 ? Math.round(nEff) : nEff.toFixed(1)}`, true);
    note.textContent = effect > 0
      ? "There is a real difference, so higher is better. But check the false alarms first: set the difference to 0."
      : "Nothing differs between the groups, so every 'significant' study is a false alarm. A fair test gives about 5%.";
  }

  res = run(st, NS, st.seed);
  draw();
}

autoMount(NAME, mount);
