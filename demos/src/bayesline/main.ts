// Bayesian regression as "many plausible lines", on the age-expression donors of the MCMC demo.
// (a) your line: sliders (or drag the two handles) for height at age 50 and slope; residual
//     sticks, total squared miss, and how believable the line is compared with the best line
//     (likelihood relative to the least-squares line).
// (b) the posterior: 50 lines drawn from it (spaghetti; rising lines blue, falling red),
//     P(slope > 0) counted over the 50 lines, the slope's 95% credible interval, and optional
//     95% bands: "mean band" (where the average line is) and "prediction band" (where one new
//     donor lands). Shared controls: number of donors used, and the width of the slope prior
//     (Normal centred at 0; narrow pulls the lines flatter, as ridge does).
// Maths in model.ts: known noise scale (1, as in the MCMC demo), flat prior on the height,
// so the posterior is an exact 2D Normal.
//
// Auto-mounts on <div data-demo="bayesline">. data-* options (all optional):
//   data-n="12"        donors used (2-12, added in a fixed order spread over ages)
//   data-prior="1"     slope prior width per 10 years: 0.1 0.2 0.3 0.5 1 2 5 or "flat"
//   data-bands="none"  none | mean | pred | both
//   data-lines="off"   on = show the 50 lines from the start
//   data-line="6.2 0"  starting user line: height at age 50, slope per 10 years
//   data-seed="1"      seed for the 50 lines
import { svgEl, htmlEl, slider, button, checkbox, scale, rng, autoMount, svgPoint, draggable, numList } from "../lib/ui";
import { AGES, EXPR, usedDonors, posterior, bestLine, sumSq, relLik, draws, bandAt, probPos, toX, Post } from "./model";

const NAME = "bayesline";
const PRIORS = [0.1, 0.2, 0.3, 0.5, 1, 2, 5, Infinity];
const NLINES = 50;
const COL = { up: "var(--qb-c1)", down: "var(--qb-c2)", user: "var(--qb-c4)", stick: "var(--qb-c2)",
  pt: "#333", unused: "#b5b5b5", mean: "var(--qb-c1)", pred: "#8a8a8a" };
const STYLE = `
[data-demo="${NAME}"] { flex-direction: column; gap: .4em; }
[data-demo="${NAME}"] .bl-row { display: flex; flex-wrap: wrap; gap: .3em 1.4em; align-items: center; width: 100%; }
[data-demo="${NAME}"] .bl-row .qb-slider { flex: 1 1 240px; }
[data-demo="${NAME}"] .bl-plots { display: flex; flex-wrap: wrap; gap: 12px; width: 100%; }
[data-demo="${NAME}"] .bl-col { flex: 1 1 380px; min-width: 0; max-width: calc(50% - 6px); display: flex; flex-direction: column; gap: .25em; }
[data-demo="${NAME}"] .bl-col svg { width: 100%; height: auto; }
[data-demo="${NAME}"] .bl-col .bl-row { gap: .25em .8em; }
[data-demo="${NAME}"] .bl-col .qb-slider { flex: 1 1 200px; }
[data-demo="${NAME}"] svg text { font-size: 17px; }
[data-demo="${NAME}"] svg .ttl { font-size: 19px; font-weight: 600; }
[data-demo="${NAME}"] svg .sm { font-size: 15.5px; fill: #555; }
[data-demo="${NAME}"] .qb-note { margin: 0; }
[data-demo="${NAME}"] .bl-sw { display: inline-block; width: .9em; height: .9em; border-radius: 2px; margin-left: .15em; vertical-align: -.1em; }
.reveal [data-demo="${NAME}"] { font-size: 18px; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 16px; }
.reveal [data-demo="${NAME}"] .qb-check input { width: 1.1em; height: 1.1em; }
@media (max-width: 760px) {
  [data-demo="${NAME}"] .bl-col { max-width: 100%; flex-basis: 100%; }
  [data-demo="${NAME}"] svg text { font-size: 19px; }
  [data-demo="${NAME}"] svg .ttl { font-size: 20px; }
  [data-demo="${NAME}"] svg .sm { font-size: 17px; }
}
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

let mountCount = 0;
const f1 = (v: number): string => (Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1)).replace("-", "−");
const f2 = (v: number): string => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2)).replace("-", "−");
const fmtPrior = (i: number): string => (Number.isFinite(PRIORS[i]) ? `±${PRIORS[i]}` : "flat");

function mount(host: HTMLElement): void {
  injectStyle();
  const ds = host.dataset;
  const num = (v: string | undefined, d: number) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  const priorIdx = (v: string | undefined): number => {
    if (v && /flat|inf|none/i.test(v)) return PRIORS.length - 1;
    const w = num(v, 1);
    let b = 0;
    PRIORS.forEach((p, i) => { if (Math.abs(Math.log(p / w)) < Math.abs(Math.log(PRIORS[b] / w))) b = i; });
    return w > 50 ? PRIORS.length - 1 : b;
  };
  const bands = (ds.bands ?? "none").toLowerCase();
  const line0 = numList(ds.line, [6.2, 0]);
  const st = {
    n: Math.max(2, Math.min(12, Math.round(num(ds.n, 12)))),
    pi: priorIdx(ds.prior),
    a: line0[0] ?? 6.2, b: line0[1] ?? 0,
    lines: ds.lines === "on" || ds.lines === "1",
    meanBand: bands === "mean" || bands === "both",
    predBand: bands === "pred" || bands === "both",
    seed: Math.round(num(ds.seed, 1)),
  };
  let z: [number, number][] = [];
  const newZ = () => { const r = rng(st.seed * 7919 + 13); z = Array.from({ length: NLINES }, () => [r.norm(), r.norm()] as [number, number]); };
  newZ();

  // ---------------- layout ----------------
  const top = htmlEl("div", "bl-row", "", host);
  slider(top, "donors", 2, 12, 1, st.n, v => { st.n = v; drawAll(); });
  slider(top, "slope prior: narrow ↔ wide", 0, PRIORS.length - 1, 1, st.pi, v => { st.pi = v; drawB(); }, fmtPrior);

  const plots = htmlEl("div", "bl-plots", "", host);
  const colA = htmlEl("div", "bl-col", "", plots), colB = htmlEl("div", "bl-col", "", plots);
  const W = 560, H = 400, pL = 52, pR = W - 12, pT = 90, pB = H - 46;
  const svgA = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Donors with your line and its misses" }, colA);
  const svgB = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Fifty lines drawn from the posterior" }, colB);

  const ctrA = htmlEl("div", "bl-row", "", colA);
  const sA = slider(ctrA, "height at age 50", 3, 9.5, 0.05, st.a, v => { st.a = v; drawA(); }, v => v.toFixed(1));
  const sB = slider(ctrA, "slope", -1.5, 1.5, 0.01, st.b, v => { st.b = v; drawA(); }, v => f2(v));
  button(ctrA, "best line", () => {
    const [a, b] = bestLine(usedDonors(st.n));
    st.a = Math.round(a * 20) / 20; st.b = Math.round(b * 100) / 100;
    sA.set(st.a); sB.set(st.b); drawA();
  });

  const ctrB = htmlEl("div", "bl-row", "", colB);
  const showBtn = button(ctrB, "", () => { st.lines = !st.lines; drawB(); });
  button(ctrB, "draw again", () => { st.seed++; newZ(); st.lines = true; drawB(); });
  const cbM = checkbox(ctrB, "mean band", st.meanBand, v => { st.meanBand = v; drawB(); });
  const cbP = checkbox(ctrB, "prediction band", st.predBand, v => { st.predBand = v; drawB(); });
  for (const [cb, col, op] of [[cbM, COL.mean, 0.3], [cbP, COL.pred, 0.3]] as [HTMLInputElement, string, number][]) {
    const sw = htmlEl("span", "bl-sw", "", cb.parentElement!);
    sw.style.background = col; sw.style.opacity = String(op + 0.15);
  }
  htmlEl("p", "qb-note",
    "Lines far from the points are less believable. Slope = change in expression per 10 years. Noise scale fixed at 1; bands are 95%.", host);

  // ---------------- shared axes ----------------
  const AGE: [number, number] = [20, 80], EXP: [number, number] = [2.5, 9.5];
  const sx = scale(AGE[0], AGE[1], pL, pR), sy = scale(EXP[0], EXP[1], pB, pT);
  const clipFor = (svg: SVGSVGElement): string => {
    const id = `bl-clip-${++mountCount}`;
    const cp = svgEl("clipPath", { id }, svgEl("defs", {}, svg));
    svgEl("rect", { x: pL, y: pT, width: pR - pL, height: pB - pT }, cp);
    return `url(#${id})`;
  };
  const axes = (svg: SVGSVGElement): void => {
    for (let v = 3; v <= 9; v++) {
      svgEl("line", { x1: pL, x2: pR, y1: sy(v), y2: sy(v), class: "grid" }, svg);
      svgEl("text", { x: pL - 6, y: sy(v) + 5, "text-anchor": "end", class: "sm" }, svg).textContent = String(v);
    }
    for (let v = 20; v <= 80; v += 10) {
      svgEl("line", { x1: sx(v), x2: sx(v), y1: pT, y2: pB, class: "grid" }, svg);
      svgEl("text", { x: sx(v), y: pB + 19, "text-anchor": "middle", class: "sm" }, svg).textContent = String(v);
    }
    svgEl("rect", { x: pL, y: pT, width: pR - pL, height: pB - pT, fill: "none", class: "axis" }, svg);
    svgEl("text", { x: (pL + pR) / 2, y: H - 6, "text-anchor": "middle" }, svg).textContent = "age (years)";
    const yc = (pT + pB) / 2;
    svgEl("text", { x: 15, y: yc, "text-anchor": "middle", transform: `rotate(-90 15 ${yc})` }, svg).textContent = "expression";
  };
  const dots = (svg: Element, used: number[]): void => {
    AGES.forEach((age, i) => {
      if (used.includes(i)) return;
      svgEl("circle", { cx: sx(age), cy: sy(EXPR[i]), r: 5, fill: "none", stroke: COL.unused, "stroke-width": 1.8 }, svg);
    });
    for (const i of used) svgEl("circle", { cx: sx(AGES[i]), cy: sy(EXPR[i]), r: 6, fill: COL.pt, stroke: "#fff", "stroke-width": 1.5 }, svg);
  };
  const lineAt = (a: number, b: number, age: number) => a + b * toX(age);
  const segment = (g: Element, a: number, b: number, attrs: Record<string, string | number>) =>
    svgEl("line", { x1: sx(AGE[0]), x2: sx(AGE[1]), y1: sy(lineAt(a, b, AGE[0])), y2: sy(lineAt(a, b, AGE[1])), ...attrs }, g);

  // ---------------- (a) your line ----------------
  const clipA = clipFor(svgA);
  axes(svgA);
  const gA = svgEl("g", {}, svgA);
  const HAGE = [25, 75];
  const handles = HAGE.map(() => svgEl("circle", { r: 9, class: "handle", stroke: COL.user }, svgA));
  const worldY = (ev: PointerEvent): [number, number] => {
    const [, py] = svgPoint(svgA, ev);
    return [0, Math.max(EXP[0], Math.min(EXP[1], sy.invert(py)))];
  };
  handles.forEach((h, k) => draggable(h, worldY, (_x, y) => {
    // keep the other handle fixed, move this one to height y
    const other = 1 - k;
    const yo = lineAt(st.a, st.b, HAGE[other]);
    const xk = toX(HAGE[k]), xo = toX(HAGE[other]);
    let b = (y - yo) / (xk - xo);
    b = Math.max(-1.5, Math.min(1.5, b));
    let a = yo - b * xo;
    a = Math.max(3, Math.min(9.5, a));
    st.a = a; st.b = b; sA.set(Math.round(a * 20) / 20); sB.set(Math.round(b * 100) / 100);
    drawA();
  }));

  function drawA(): void {
    const used = usedDonors(st.n);
    gA.replaceChildren();
    const ss = sumSq(used, st.a, st.b);
    const [a0, b0] = bestLine(used);
    const ssMin = sumSq(used, a0, b0);
    const rl = relLik(used, st.a, st.b);
    svgEl("text", { x: 8, y: 24, class: "ttl" }, gA).textContent = `(a) your line through ${used.length} donors`;
    const t2 = svgEl("text", { x: 8, y: 50 }, gA);
    t2.textContent = `total squared miss: ${ss.toFixed(1)}`;
    const t2b = svgEl("tspan", { class: "sm" }, t2);
    t2b.textContent = `   (best line: ${ssMin.toFixed(1)})`;
    // believability bar
    svgEl("text", { x: 8, y: 76 }, gA).textContent = "believable:";
    const bx = 114, bw = 210;
    svgEl("rect", { x: bx, y: 61, width: bw, height: 18, rx: 3, fill: "var(--qb-panel)", stroke: "#bbb" }, gA);
    svgEl("rect", { x: bx, y: 61, width: Math.max(0, bw * rl), height: 18, rx: 3, fill: COL.user, "fill-opacity": 0.85 }, gA);
    svgEl("text", { x: bx + bw + 8, y: 76 }, gA).textContent = `${rl >= 0.995 ? 100 : rl < 0.005 && rl > 0 ? "<1" : Math.round(100 * rl)}%`;
    svgEl("text", { x: bx + bw + 54, y: 76, class: "sm" }, gA).textContent = "of the best line";

    const gc = svgEl("g", { "clip-path": clipA }, gA);
    for (const i of used) {
      const yl = lineAt(st.a, st.b, AGES[i]);
      svgEl("line", { x1: sx(AGES[i]), x2: sx(AGES[i]), y1: sy(EXPR[i]), y2: sy(yl), stroke: COL.stick, "stroke-width": 2.5, "stroke-opacity": 0.75 }, gc);
    }
    segment(gc, st.a, st.b, { stroke: COL.user, "stroke-width": 3.5 });
    dots(gA, used);
    HAGE.forEach((age, k) => {
      const y = Math.max(EXP[0], Math.min(EXP[1], lineAt(st.a, st.b, age)));
      handles[k].setAttribute("cx", String(sx(age)));
      handles[k].setAttribute("cy", String(sy(y)));
    });
    svgA.appendChild(handles[0]); svgA.appendChild(handles[1]);
  }

  // ---------------- (b) plausible lines ----------------
  const clipB = clipFor(svgB);
  axes(svgB);
  const gB = svgEl("g", {}, svgB);

  function bandPath(p: Post, pred: boolean): string {
    const up: string[] = [], lo: string[] = [];
    for (let age = AGE[0]; age <= AGE[1] + 1e-9; age += 1) {
      const [m, s] = bandAt(p, age, pred);
      up.push(`${sx(age).toFixed(1)},${sy(m + 1.96 * s).toFixed(1)}`);
      lo.unshift(`${sx(age).toFixed(1)},${sy(m - 1.96 * s).toFixed(1)}`);
    }
    return "M" + up.join("L") + "L" + lo.join("L") + "Z";
  }

  function drawB(): void {
    const used = usedDonors(st.n);
    const p = posterior(used, PRIORS[st.pi]);
    showBtn.textContent = st.lines ? `hide the ${NLINES} lines` : `show ${NLINES} posterior lines`;
    showBtn.classList.toggle("active", st.lines);
    gB.replaceChildren();
    svgEl("text", { x: 8, y: 24, class: "ttl" }, gB).textContent = `(b) plausible lines, slope prior ${fmtPrior(st.pi)}`;
    const ds = draws(p, z);
    const nPos = ds.filter(d => d[1] > 0).length;
    const t2 = svgEl("text", { x: 8, y: 50 }, gB);
    if (st.lines) {
      const s1 = svgEl("tspan", { "font-weight": 600 }, t2);
      s1.textContent = `P(slope > 0) = ${nPos} of ${NLINES} lines`;
    } else {
      svgEl("tspan", {}, t2).textContent = "P(slope > 0):";
    }
    svgEl("tspan", { class: "sm" }, t2).textContent = `   (exact ${Math.round(100 * probPos(p))}%)`;
    const sd = Math.sqrt(p.sbb);
    svgEl("text", { x: 8, y: 76 }, gB).textContent =
      `slope ${f2(p.mb)}, 95% credible interval ${f2(p.mb - 1.96 * sd)} to ${f2(p.mb + 1.96 * sd)}`;

    const gc = svgEl("g", { "clip-path": clipB }, gB);
    if (st.predBand) svgEl("path", { d: bandPath(p, true), fill: COL.pred, "fill-opacity": 0.22 }, gc);
    if (st.meanBand) svgEl("path", { d: bandPath(p, false), fill: COL.mean, "fill-opacity": 0.28 }, gc);
    if (st.lines) {
      const gl = svgEl("g", { "stroke-width": 1.6 }, gc);
      for (const [a, b] of ds)
        segment(gl, a, b, b > 0 ? { stroke: COL.up, "stroke-opacity": 0.4 } : { stroke: COL.down, "stroke-opacity": 0.65 });
    }
    if (st.meanBand && st.lines) // keep the mean band visible on top of the lines
      svgEl("path", { d: bandPath(p, false), fill: "none", stroke: COL.mean, "stroke-width": 2.5 }, gc);
    segment(gc, p.ma, p.mb, { stroke: "#222", "stroke-width": 2.5, "stroke-dasharray": st.lines ? "7 5" : "" });
    dots(gB, used);
    // legend, bottom right inside the plot
    const leg: [string, string, number][] = [];
    if (st.lines) leg.push(["rising", COL.up, 0.8], ["falling", COL.down, 0.8]);
    leg.push(["average line", "#222", 1]);
    let lx = pR - 8;
    for (let k = leg.length - 1; k >= 0; k--) {
      const [lab, col] = leg[k];
      const t = svgEl("text", { x: lx, y: pB - 10, "text-anchor": "end", class: "sm" }, gB);
      t.textContent = lab;
      const w = lab.length * 8.2;
      svgEl("line", { x1: lx - w - 26, x2: lx - w - 6, y1: pB - 15, y2: pB - 15, stroke: col, "stroke-width": 3 }, gB);
      lx -= w + 40;
    }
  }

  function drawAll(): void { drawA(); drawB(); }
  drawAll();
}

autoMount(NAME, mount);
