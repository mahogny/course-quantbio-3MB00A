// Compensation editor. Simulated two-colour flow cytometry (FITC, PE; the lecture's four
// populations), measured = S × true + noise. Left: the measured (uncompensated) cells.
// Right: the cells after compensation with the student's guess, S_guess⁻¹ × measured.
// Sliders set the guessed spillover s21 (FITC → PE detector) and s12 (PE → FITC detector).
// A least-squares line through each single-positive population shows the tilt:
// up = under-compensated, flat = right, down = over-compensated.
// Auto-mounts on <div data-demo="compensation">. Optional attributes:
//   data-s21="0.25" data-s12="0.02"  the true (hidden) spillover used to simulate the data
//   data-start="0 0"                 initial guess (s21 s12)
//   data-seed="1"                    random seed
import { svgEl, htmlEl, slider, presets, scale, numList, autoMount } from "../lib/ui";
import { GROUPS, Group, spill, inv2, simulate, apply, summary, M2 } from "./math";

const NAME = "compensation";
const STYLE = `
[data-demo="${NAME}"].qb-demo { gap: 1em; }
[data-demo="${NAME}"].qb-demo .qb-plot { flex: 1 1 100%; max-width: 800px; }
[data-demo="${NAME}"].qb-demo .qb-panel { flex: 1 1 100%; max-width: 560px; gap: .45em; }
.reveal [data-demo="${NAME}"].qb-demo { flex-wrap: nowrap; }
[data-demo="${NAME}"].qb-demo .cp-legend { display: flex; flex-wrap: wrap; gap: .1em .8em; font-size: .85em; }
[data-demo="${NAME}"].qb-demo .cp-legend span::before { content: ""; display: inline-block; width: .75em; height: .75em;
  border-radius: 50%; margin-right: .3em; background: var(--dot); vertical-align: -.05em; }
[data-demo="${NAME}"].qb-demo .cp-status { display: flex; flex-direction: column; gap: .3em; font-size: .9em; }
[data-demo="${NAME}"].qb-demo .cp-status div { border-left: 5px solid #ccc; padding: .1em .5em; }
[data-demo="${NAME}"].qb-demo .cp-status b { font-family: ui-monospace, monospace; }
[data-demo="${NAME}"].qb-demo .cp-ok { color: #1a7f37; font-weight: 600; }
[data-demo="${NAME}"].qb-demo .cp-under { color: #b35900; font-weight: 600; }
[data-demo="${NAME}"].qb-demo .cp-over { color: #c62828; font-weight: 600; }
[data-demo="${NAME}"].qb-demo .cp-true { color: #555; font-size: .85em; }
.reveal [data-demo="${NAME}"].qb-demo { font-size: 20px; }
.reveal [data-demo="${NAME}"].qb-demo .qb-plot { flex: 0 0 760px; max-width: 760px; }
.reveal [data-demo="${NAME}"].qb-demo .qb-panel { flex: 0 0 370px; max-width: none; }
.reveal [data-demo="${NAME}"].qb-demo .qb-readout { font-size: 19px; }
`;

const PAL: Record<Group, string> = { "unstained": "#8c8c8c", "FITC+": "#009E73", "PE+": "#D55E00", "FITC+ PE+": "#7B3294" };
const DARK: Record<Group, string> = { "unstained": "#444", "FITC+": "#00563f", "PE+": "#8a3000", "FITC+ PE+": "#4b1d5c" };
const FLAT = 0.015;   // |slope| below this counts as flat

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => (v < 0 ? "" : " ") + v.toFixed(3);
const int = (v: number) => (Math.round(v) < 0 ? "−" : "") + Math.abs(Math.round(v));
const sgn = (v: number) => (Math.abs(v) < 0.005 ? " " : v > 0 ? "+" : "−") + Math.abs(v).toFixed(2);

function mount(host: HTMLElement): void {
  injectStyle();
  const num = (s: string | undefined, d: number) => (s && Number.isFinite(Number(s)) ? Number(s) : d);
  const trueS = spill(num(host.dataset.s21, 0.25), num(host.dataset.s12, 0.02));
  const start = numList(host.dataset.start, [0, 0]);
  const cells = simulate(trueS, Number(host.dataset.seed ?? 1) || 1);
  const g = { s21: start[0] ?? 0, s12: start[1] ?? 0 };
  let revealed = false;

  // ---- plots: one SVG, two panels ----
  const W = 800, H = 420, P = 320, TOP = 42, LO = -1000, HI = 5000;
  const X0 = [80, 476];
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "qb-plot", role: "img",
    "aria-label": "Measured and compensated flow cytometry cells, FITC detector against PE detector" }, host);
  const defs = svgEl("defs", {}, svg);
  const sy = scale(LO, HI, TOP + P, TOP);
  const sxs = X0.map(x0 => scale(LO, HI, x0, x0 + P));
  const titles = ["before: measured", "after: S⁻¹ × measured"];
  const xl = ["FITC detector", "FITC (compensated)"], yl = ["PE detector", "PE (compensated)"];
  const layers: SVGGElement[] = [];
  X0.forEach((x0, k) => {
    const sx = sxs[k];
    const clip = svgEl("clipPath", { id: `cp-clip-${k}-${Math.random().toString(36).slice(2, 8)}` }, defs);
    svgEl("rect", { x: x0, y: TOP, width: P, height: P }, clip);
    const fr = svgEl("g", {}, svg);
    svgEl("rect", { x: x0, y: TOP, width: P, height: P, fill: "none", stroke: "#999" }, fr);
    for (let v = 0; v <= 4000; v += 1000) {
      svgEl("line", { x1: sx(v), y1: TOP, x2: sx(v), y2: TOP + P, class: v === 0 ? "axis" : "grid", "stroke-width": v === 0 ? 1.5 : 1 }, fr);
      svgEl("line", { x1: x0, y1: sy(v), x2: x0 + P, y2: sy(v), class: v === 0 ? "axis" : "grid", "stroke-width": v === 0 ? 1.5 : 1 }, fr);
      if (v % 2000 === 0) {
        svgEl("text", { x: sx(v), y: TOP + P + 22, "text-anchor": "middle", "font-size": 19, fill: "#555" }, fr).textContent = String(v);
        svgEl("text", { x: x0 - 6, y: sy(v) + 6, "text-anchor": "end", "font-size": 19, fill: "#666" }, fr).textContent = String(v);
      }
    }
    svgEl("text", { x: x0 + P / 2, y: TOP + P + 48, "text-anchor": "middle", "font-size": 20 }, fr).textContent = xl[k];
    svgEl("text", { x: x0 - 62, y: TOP + P / 2, "text-anchor": "middle", "font-size": 20,
      transform: `rotate(-90 ${x0 - 62} ${TOP + P / 2})` }, fr).textContent = yl[k];
    svgEl("text", { x: x0 + P / 2, y: TOP - 14, "text-anchor": "middle", "font-size": 21, "font-weight": 600 }, fr).textContent = titles[k];
    layers.push(svgEl("g", { "clip-path": `url(#${clip.id})` }, svg));
  });

  // cells as one path per population ("M x y h0" + round caps = a dot)
  const dotPath = (sx: (v: number) => number, x: Float64Array, y: Float64Array, grp: Group) => {
    let d = "";
    for (let i = 0; i < x.length; i++) if (cells.group[i] === grp) d += `M${sx(x[i]).toFixed(1)} ${sy(y[i]).toFixed(1)}h0`;
    return d;
  };
  const mkDots = (k: number) => {
    const o = {} as Record<Group, SVGPathElement>;
    for (const grp of GROUPS) o[grp] = svgEl("path", { d: "", stroke: PAL[grp], "stroke-width": 4.5,
      "stroke-linecap": "round", "stroke-opacity": 0.55, fill: "none" }, layers[k]);
    return o;
  };
  const meas = mkDots(0), comp = mkDots(1);
  for (const grp of GROUPS) meas[grp].setAttribute("d", dotPath(sxs[0], cells.mx, cells.my, grp));

  // reference lines and trend lines on the compensated plot
  const L = layers[1], sx1 = sxs[1];
  const refH = svgEl("line", { stroke: "#333", "stroke-width": 2, "stroke-dasharray": "7 5" }, L);
  const refV = svgEl("line", { stroke: "#333", "stroke-width": 2, "stroke-dasharray": "7 5" }, L);
  const trF = svgEl("line", { stroke: DARK["FITC+"], "stroke-width": 5, "stroke-linecap": "round" }, L);
  const trP = svgEl("line", { stroke: DARK["PE+"], "stroke-width": 5, "stroke-linecap": "round" }, L);
  const labF = svgEl("text", { "font-size": 20, "font-weight": 700, fill: DARK["FITC+"], "text-anchor": "end" }, svg);
  const labP = svgEl("text", { "font-size": 20, "font-weight": 700, fill: DARK["PE+"] }, svg);

  // ---- panel ----
  const panel = htmlEl("div", "qb-panel", "", host);
  const leg = htmlEl("div", "cp-legend", "", panel);
  for (const grp of ["unstained", "FITC+", "PE+", "FITC+ PE+"] as Group[]) htmlEl("span", "", grp, leg).style.setProperty("--dot", PAL[grp]);
  const sl21 = slider(panel, "s₂₁ FITC→PE", 0, 0.5, 0.01, g.s21, v => { g.s21 = v; manual(); });
  const sl12 = slider(panel, "s₁₂ PE→FITC", 0, 0.5, 0.01, g.s12, v => { g.s12 = v; manual(); });
  const set = (a: number, b: number) => { g.s21 = a; g.s12 = b; sl21.set(a); sl12.set(b); draw(); };
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const btns = presets(panel, [
    { label: "No compensation", apply: () => set(0, 0) },
    { label: "Under", apply: () => set(Math.max(0, r2(trueS[2] - 0.1)), g.s12) },
    { label: "Over", apply: () => set(Math.min(0.5, r2(trueS[2] + 0.1)), g.s12) },
    { label: "Reveal true S", apply: () => { revealed = true; set(r2(trueS[2]), r2(trueS[1])); } },
  ]);
  const manual = () => { btns.forEach(b => b.classList.remove("active")); draw(); };
  const mat = htmlEl("div", "qb-readout", "", panel);
  const status = htmlEl("div", "cp-status", "", panel);
  const stF = htmlEl("div", "", "", status), stP = htmlEl("div", "", "", status);
  stF.style.borderColor = PAL["FITC+"]; stP.style.borderColor = PAL["PE+"];
  const truth = htmlEl("div", "cp-true", "", panel);

  function verdict(b: number, which: string, up: string, down: string): string {
    if (Math.abs(b) < FLAT) return `<span class="cp-ok">flat: compensated</span>`;
    return b > 0 ? `<span class="cp-under">${up}: under (${which} too small)</span>`
                 : `<span class="cp-over">${down}: over (${which} too large)</span>`;
  }

  function draw(): void {
    const S: M2 = spill(g.s21, g.s12), C = inv2(S);
    const { x, y } = apply(C, cells);
    for (const grp of GROUPS) comp[grp].setAttribute("d", dotPath(sx1, x, y, grp));
    const s = summary(cells, x, y);
    const xa = x0Clamp(s.fitcRange[0]), xb = x0Clamp(s.fitcRange[1]);
    const pa = x0Clamp(s.peRange[0]), pb = x0Clamp(s.peRange[1]);
    set4(refH, sx1(LO), sy(s.medUnY), sx1(HI), sy(s.medUnY));
    set4(refV, sx1(s.medUnX), sy(LO), sx1(s.medUnX), sy(HI));
    set4(trF, sx1(xa), sy(s.fitc.a + s.fitc.b * xa), sx1(xb), sy(s.fitc.a + s.fitc.b * xb));
    set4(trP, sx1(s.pe.a + s.pe.b * pa), sy(pa), sx1(s.pe.a + s.pe.b * pb), sy(pb));
    // slope labels, kept inside the plot box
    const clampY = (v: number) => Math.min(TOP + P - 8, Math.max(TOP + 22, v));
    const clampX = (v: number) => Math.min(X0[1] + P - 8, Math.max(X0[1] + 8, v));
    setXY(labF, X0[1] + P - 8, clampY(sy(s.fitc.a + s.fitc.b * xb) - 14));
    labF.textContent = `slope ${sgn(s.fitc.b)}`;
    setXY(labP, clampX(sx1(s.pe.a + s.pe.b * pb) + 10), TOP + 24);
    labP.textContent = `slope ${sgn(s.pe.b)}`;

    mat.textContent =
      `S   = [${f2(S[0])}  ${f2(S[1])}]\n` +
      `      [${f2(S[2])}  ${f2(S[3])}]\n` +
      `S⁻¹ = [${f3(C[0])} ${f3(C[1])}]\n` +
      `      [${f3(C[2])} ${f3(C[3])}]`;
    const neg = (p: number, ch: string) => (p > 0.05 ? `; ${Math.round(p * 100)} % below 0 ${ch}` : "");
    stF.innerHTML = `FITC+ slope <b>${sgn(s.fitc.b)}</b>: ${verdict(s.fitc.b, "s₂₁", "tilts up", "tilts down")}<br>` +
      `median PE <b>${int(s.medFitcPE)}</b> (unstained <b>${int(s.medUnY)}</b>)${neg(s.negFitcPE, "PE")}`;
    stP.innerHTML = `PE+ slope <b>${sgn(s.pe.b)}</b>: ${verdict(s.pe.b, "s₁₂", "leans right", "leans left")}<br>` +
      `median FITC <b>${int(s.medPeFITC)}</b> (unstained <b>${int(s.medUnX)}</b>)${neg(s.negPeFITC, "FITC")}`;
    truth.textContent = revealed ? `True: s₂₁ = ${f2(trueS[2])}, s₁₂ = ${f2(trueS[1])}` : "";
  }
  const x0Clamp = (v: number) => Math.min(HI, Math.max(LO, v));
  const set4 = (e: SVGLineElement, x1: number, y1: number, x2: number, y2: number) => {
    e.setAttribute("x1", x1.toFixed(1)); e.setAttribute("y1", y1.toFixed(1));
    e.setAttribute("x2", x2.toFixed(1)); e.setAttribute("y2", y2.toFixed(1));
  };
  const setXY = (e: SVGTextElement, x: number, y: number) => { e.setAttribute("x", x.toFixed(1)); e.setAttribute("y", y.toFixed(1)); };
  draw();
}

autoMount(NAME, mount);
