// Two equations, two lines. Each equation a·x1 + b·x2 = c is a line in the
// (x1, x2) plane: the lines cross (one solution), are parallel (none) or are the
// same line (infinitely many). Sliders for a, b, c; drag the round handle to shift
// a line, the filled handle to turn it. The status box gives the case and the
// reason, and a readout shows the elimination step R2 -> R2 - m·R1 with the
// current numbers (0 = c ≠ 0: none; 0 = 0: a free variable). No determinants.
// Auto-mounts on <div data-demo="twolines">. Optional: data-eq1="2 1 8" data-eq2="1 3 9".
import { svgEl, htmlEl, slider, presets, draggable, svgPoint, scale, numList, autoMount, Slider } from "../lib/ui";
import { Eq, P2, Result, classify, clipLine, anchorOn, shiftTo, turnTo, fmt, fmtFrac } from "./math";

const NAME = "twolines";
let uid = 0;
const COL = ["#1f77b4", "#e6550d"];
const KIND = { unique: "#2ca02c", none: "#d62728", infinite: "#7b4fa6" };
const SUB = ["₁", "₂"];
const STYLE = `
.qb-demo[data-demo="${NAME}"] { flex-wrap: nowrap; }
.qb-demo[data-demo="${NAME}"] .qb-plot { flex: 0 1 500px; max-width: 500px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-plot { flex: 0 0 500px; width: 500px; height: 500px; max-width: none; }
.qb-demo[data-demo="${NAME}"] .qb-panel { flex: 1 1 560px; max-width: 640px; gap: .5em; }
.qb-demo[data-demo="${NAME}"] .tl-eqs { display: grid; grid-template-columns: 1fr 1fr; gap: .2em 1em; }
.qb-demo[data-demo="${NAME}"] .tl-eq { display: flex; flex-direction: column; gap: .1em; min-width: 0; }
.qb-demo[data-demo="${NAME}"] .tl-eqtxt { font-family: ui-monospace, monospace; font-weight: 700; font-size: 1.1em; white-space: nowrap; }
.qb-demo[data-demo="${NAME}"] .qb-slider { grid-template-columns: 1.5em 1fr 3em; gap: .35em; }
.qb-demo[data-demo="${NAME}"] .qb-slider input[type=range] { min-width: 4em; }
.qb-demo[data-demo="${NAME}"] .tl-status { border: 3px solid; border-radius: 8px; padding: .3em .6em; }
.qb-demo[data-demo="${NAME}"] .tl-title { font-size: 1.25em; font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .tl-why { margin-top: .15em; }
.qb-demo[data-demo="${NAME}"] .qb-readout { line-height: 1.4; }
.qb-demo[data-demo="${NAME}"] .c0 { color: ${COL[0]}; } .qb-demo[data-demo="${NAME}"] .c1 { color: ${COL[1]}; }
.reveal .qb-demo[data-demo="${NAME}"] { font-size: 19px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-readout { font-size: 18px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-note { font-size: 18px; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

const readEq = (s: string | undefined, fb: number[]): Eq => {
  const v = numList(s, fb);
  return v.length >= 3 ? { a: v[0], b: v[1], c: v[2] } : { a: fb[0], b: fb[1], c: fb[2] };
};

/** "2x₁ + 1x₂ = 8", coefficients always written out, as on the slides. */
function eqText(e: Eq): string {
  const b = e.b < 0 ? ` − ${fmt(-e.b)}` : ` + ${fmt(e.b)}`;
  return `${fmt(e.a)}x₁${b}x₂ = ${fmt(e.c)}`;
}

const RANGE = { ab: [-4, 4, 0.1], c: [-12, 12, 0.5] } as const;

function mount(host: HTMLElement): void {
  injectStyle();
  const init: [Eq, Eq] = [readEq(host.dataset.eq1, [2, 1, 8]), readEq(host.dataset.eq2, [1, 3, 9])];
  const eqs: [Eq, Eq] = [{ ...init[0] }, { ...init[1] }];
  const anchors: (P2 | null)[] = [null, null];
  const side = [1, -1];

  // ---- plot ----
  const W = 500, LO = -6, HI = 6, PAD = 16, BX = 5.5, R = 2.2;
  const sx = scale(LO, HI, PAD, W - PAD), sy = scale(LO, HI, W - PAD, PAD);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${W}`, class: "qb-plot", role: "img",
    "aria-label": "Two equations drawn as two lines in the x1, x2 plane" }, host);
  const plane = svgEl("rect", { x: sx(LO), y: sy(HI), width: sx(HI) - sx(LO), height: sy(LO) - sy(HI), fill: KIND.infinite, opacity: 0 }, svg);
  const grid = svgEl("g", {}, svg);
  for (let i = LO; i <= HI; i++) {
    const cls = i === 0 ? "axis" : "grid", w = i === 0 ? 2 : 1;
    svgEl("line", { x1: sx(i), y1: sy(LO), x2: sx(i), y2: sy(HI), class: cls, "stroke-width": w }, grid);
    svgEl("line", { x1: sx(LO), y1: sy(i), x2: sx(HI), y2: sy(i), class: cls, "stroke-width": w }, grid);
    if (i !== 0 && i % 2 === 0 && Math.abs(i) < HI) {
      svgEl("text", { x: sx(i), y: sy(0) + 20, "text-anchor": "middle", "font-size": 18, fill: "#666" }, grid).textContent = fmt(i);
      svgEl("text", { x: sx(0) - 6, y: sy(i) + 6, "text-anchor": "end", "font-size": 18, fill: "#666" }, grid).textContent = fmt(i);
    }
  }
  svgEl("text", { x: sx(HI) - 4, y: sy(0) - 8, "text-anchor": "end", "font-size": 20, "font-style": "italic" }, grid).textContent = "x₁";
  svgEl("text", { x: sx(0) + 8, y: sy(HI) + 20, "font-size": 20, "font-style": "italic" }, grid).textContent = "x₂";

  const clipId = `${NAME}-clip-${++uid}`;
  const cp = svgEl("clipPath", { id: clipId }, svgEl("defs", {}, svg));
  svgEl("rect", { x: sx(LO), y: sy(HI), width: sx(HI) - sx(LO), height: sy(LO) - sy(HI) }, cp);
  const lay = svgEl("g", { "clip-path": `url(#${clipId})` }, svg);
  const under = svgEl("line", { stroke: KIND.infinite, "stroke-width": 16, opacity: 0.3, "stroke-linecap": "round" }, lay);
  const lines = COL.map(c => svgEl("line", { stroke: c, "stroke-width": 4, "stroke-linecap": "round" }, lay));
  const guides = svgEl("path", { fill: "none", stroke: "#555", "stroke-width": 1.5, "stroke-dasharray": "4 5" }, lay);
  const dot = svgEl("circle", { r: 8, fill: "#111", stroke: "#fff", "stroke-width": 2 }, lay);
  const HALO = { stroke: "#fff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round" };
  const dotLab = svgEl("text", { "font-size": 20, "font-weight": 700, ...HALO }, lay);
  const offArrow = svgEl("path", { fill: "#111" }, lay);
  const offLab = svgEl("text", { "font-size": 19, "font-weight": 700, ...HALO }, lay);
  const labels = COL.map(c => svgEl("text", { "font-size": 20, "font-weight": 700, fill: c, "text-anchor": "middle", "dominant-baseline": "middle", ...HALO }, lay));
  const msg = svgEl("text", { x: sx(LO) + 10, y: sy(LO) - 40, "font-size": 19, "font-weight": 700, ...HALO }, svg);
  const msg2 = svgEl("text", { x: sx(LO) + 10, y: sy(LO) - 14, "font-size": 19, "font-weight": 700, ...HALO }, svg);
  const arms = COL.map(c => svgEl("line", { stroke: c, "stroke-width": 2, "stroke-dasharray": "3 4" }, svg));
  const turnH = COL.map(c => svgEl("circle", { r: 12, fill: c, stroke: "#fff", "stroke-width": 3 }, svg));
  const shiftH = COL.map(c => svgEl("circle", { r: 15, class: "handle", stroke: c }, svg));

  const toWorld = (ev: PointerEvent): [number, number] => {
    const [px, py] = svgPoint(svg, ev);
    const c = (t: number) => Math.max(LO, Math.min(HI, t));
    return [c(sx.invert(px)), c(sy.invert(py))];
  };
  const clampEq = (e: Eq): Eq => ({
    a: Math.max(RANGE.ab[0], Math.min(RANGE.ab[1], e.a)),
    b: Math.max(RANGE.ab[0], Math.min(RANGE.ab[1], e.b)),
    c: Math.max(RANGE.c[0], Math.min(RANGE.c[1], e.c)),
  });
  for (const i of [0, 1] as const) {
    const o = 1 - i;
    draggable(shiftH[i], toWorld, (x, y) => {
      const e = clampEq(shiftTo(eqs[i], eqs[o], [x, y]));
      anchors[i] = anchorOn(e, [x, y], -BX, BX);
      setEq(i, e, true);
    });
    let pivot: P2 = [0, 0], e0: Eq = eqs[i];
    turnH[i].addEventListener("pointerdown", () => { pivot = anchors[i] ?? [0, 0]; e0 = { ...eqs[i] }; });
    draggable(turnH[i], toWorld, (x, y) => {
      const e = clampEq(turnTo(e0, eqs[o], pivot, [x, y]));
      const an = anchorOn(e, pivot, -BX, BX);
      anchors[i] = an;
      if (an) side[i] = (x - an[0]) * -e.b + (y - an[1]) * e.a >= 0 ? 1 : -1;
      setEq(i, e, true);
    });
  }

  // ---- panel ----
  const panel = htmlEl("div", "qb-panel", "", host);
  const btns = presets(panel, [
    { label: "lecture: mixture", apply: () => setBoth([2, 1, 8], [1, 3, 9]) },
    { label: "parallel", apply: () => setBoth([2, 1, 8], [2, 1, 4]) },
    { label: "same line", apply: () => setBoth([2, 4, 6], [1, 2, 3]) },
    { label: "nearly parallel", apply: () => setBoth([1, 1, 2], [1, 1.1, 2.5]) },
    { label: "vertical line", apply: () => setBoth([2, 0, 6], [1, 3, 9]) },
    { label: "reset", apply: () => setBoth([init[0].a, init[0].b, init[0].c], [init[1].a, init[1].b, init[1].c]) },
  ]);
  const clearPresets = () => btns.forEach(b => b.classList.remove("active"));
  const eqBox = htmlEl("div", "tl-eqs", "", panel);
  const eqTxt: HTMLElement[] = [];
  const sl: Slider[][] = [];
  for (const i of [0, 1] as const) {
    const box = htmlEl("div", "tl-eq", "", eqBox);
    eqTxt.push(htmlEl("div", "tl-eqtxt c" + i, "", box));
    const f2 = (v: number) => fmt(v, 2);
    const mk = (k: "a" | "b" | "c") => {
      const [lo, hi, st] = k === "c" ? RANGE.c : RANGE.ab;
      return slider(box, k + SUB[i], lo, hi, st, eqs[i][k], v => {
        setEq(i, { ...eqs[i], [k]: v }, false);
      }, f2);
    };
    sl.push([mk("a"), mk("b"), mk("c")]);
    sl[i].forEach(s => (s.input.style.accentColor = COL[i]));
  }
  const status = htmlEl("div", "tl-status", "", panel);
  const sTitle = htmlEl("div", "tl-title", "", status);
  const sWhy = htmlEl("div", "tl-why", "", status);
  const ro = htmlEl("div", "qb-readout", "", panel);
  htmlEl("div", "qb-note", "Drag ○ to shift a line (changes c), ● to turn it (changes a, b). Both snap to nice values.", panel);

  function setBoth(e1: number[], e2: number[]): void {
    eqs[0] = { a: e1[0], b: e1[1], c: e1[2] }; eqs[1] = { a: e2[0], b: e2[1], c: e2[2] };
    anchors[0] = anchors[1] = null;
    for (const i of [0, 1]) (["a", "b", "c"] as const).forEach((k, j) => sl[i][j].set(eqs[i][k]));
    draw();
  }
  function setEq(i: 0 | 1, e: Eq, fromDrag: boolean): void {
    eqs[i] = e;
    if (fromDrag) (["a", "b", "c"] as const).forEach((k, j) => sl[i][j].set(e[k]));
    clearPresets();
    draw();
  }

  // fallback anchors: the point of each line nearest a fixed spot, so the handles do not overlap
  const HOME: P2[] = [[-3, 3.5], [3, -3.5]];

  function draw(): void {
    const res = classify(eqs[0], eqs[1]);
    const same = res.why === "same";

    // lines, labels, handles
    const hpos: P2[][] = [[], []];
    let lpos: P2[] = [];
    for (const i of [0, 1] as const) {
      const e = eqs[i], seg = clipLine(e, LO - 1, HI + 1);
      const show = (el: SVGElement, on: boolean) => (el.style.display = on ? "" : "none");
      show(lines[i], !!seg);
      if (seg) setLine(lines[i], seg[0], seg[1]);
      lines[i].setAttribute("stroke-width", same ? "8" : "4");
      lines[i].setAttribute("stroke-dasharray", same && i === 1 ? "18 18" : "");
      lines[i].setAttribute("stroke-linecap", same ? "butt" : "round");
      // handles: after a preset, put them 2 units from the crossing, turn handle outward
      const n = Math.hypot(e.a, e.b), d: P2 = [-e.b / n, e.a / n];
      const inBox = (p: P2) => Math.abs(p[0]) <= BX + 1e-9 && Math.abs(p[1]) <= BX + 1e-9;
      const xc = res.x;
      if (!anchors[i]) {
        // after a preset: 2 units from the crossing (or from a fixed spot), turn handle
        // pointing outward, clear of the other line's handles
        const base = xc && inBox(xc) ? xc : anchorOn(e, HOME[i], -BX, BX);
        const pref = i === 0 ? 1 : -1;
        const far = (p: P2, from: P2[], r: number) => from.every(z => Math.hypot(z[0] - p[0], z[1] - p[1]) >= r);
        let first: [P2, number] | null = null;
        if (base) search: for (const dist of xc ? [2, 3.2, 1.4, 4.4, 5.6, 6.8, 8] : [0, 1.6, 3.2, 4.8, 6.4]) for (const s of [pref, -pref]) {
          const c: P2 = [base[0] + s * dist * d[0], base[1] + s * dist * d[1]];
          const t: P2 = [c[0] + s * R * d[0], c[1] + s * R * d[1]];
          if (!inBox(c) || !inBox(t)) continue;
          first ??= [c, s];
          if (far(c, hpos[0], 1.6) && far(t, hpos[0], 1.6)) { first = [c, s]; break search; }
        }
        if (first) { anchors[i] = first[0]; side[i] = first[1]; }
      }
      const an = anchorOn(e, anchors[i] ?? HOME[i], -BX, BX);
      anchors[i] = an;
      let tp: P2 | null = null;
      if (an) {
        for (const r of [R, R * 0.6]) {
          for (const s of [side[i], -side[i]]) {
            const c: P2 = [an[0] + s * r * d[0], an[1] + s * r * d[1]];
            if (inBox(c)) { tp = c; side[i] = s; break; }
          }
          if (tp) break;
        }
        tp ??= [an[0] + side[i] * R * d[0], an[1] + side[i] * R * d[1]];
        hpos[i] = [an, tp];
      } else hpos[i] = [];
      // label near the end of the visible part that is farthest from handles and the crossing
      const vis = clipLine(e, LO + 0.6, HI - 0.6);
      show(labels[i], !!vis);
      if (vis) {
        const avoid: P2[] = [...hpos[i], ...(i === 1 ? [...hpos[0], ...lpos] : []), ...(xc ? [xc] : [])];
        const oe = eqs[1 - i], on = Math.hypot(oe.a, oe.b);
        let best: P2 = vis[0], bestD = -Infinity;
        for (const t of [0.06, 0.94, 0.3, 0.7]) for (const off of [0.45, -0.45]) {
          const p: P2 = [vis[0][0] + t * (vis[1][0] - vis[0][0]), vis[0][1] + t * (vis[1][1] - vis[0][1])];
          const q: P2 = [clampV(p[0] + off * e.a / n), clampV(p[1] + off * e.b / n)];
          let dmin = Math.min(9, ...avoid.map(z => Math.hypot(z[0] - q[0], z[1] - q[1])));
          if (on > 1e-9 && res.why !== "same") dmin = Math.min(dmin, Math.abs(oe.a * q[0] + oe.b * q[1] - oe.c) / on + 0.3);
          if (dmin > bestD + 1e-6) { bestD = dmin; best = q; }
        }
        labels[i].setAttribute("x", String(sx(best[0]))); labels[i].setAttribute("y", String(sy(best[1])));
        labels[i].textContent = "R" + (i + 1);
        if (i === 0) lpos = [best];
      } else if (i === 0) lpos = [];
      show(shiftH[i], !!an); show(turnH[i], !!an); show(arms[i], !!an);
      if (!an || !tp) continue;
      setC(shiftH[i], an); setC(turnH[i], tp); setLine(arms[i], an, tp);
    }
    under.style.display = res.why === "same" || res.why === "noconstraint" ? "" : "none";
    if (res.why === "same" || res.why === "noconstraint") {
      const k = res.why === "noconstraint" ? 1 - (res.zeroRow ?? 0) : 0;
      const seg = clipLine(eqs[k], LO - 1, HI + 1);
      if (seg) setLine(under, seg[0], seg[1]);
    }
    plane.setAttribute("opacity", res.why === "plane" ? "0.12" : "0");

    // the crossing point
    const x = res.x;
    const onPlot = !!x && Math.abs(x[0]) <= HI - 0.25 && Math.abs(x[1]) <= HI - 0.25;
    for (const el of [dot, dotLab, guides]) el.style.display = onPlot ? "" : "none";
    for (const el of [offArrow, offLab]) el.style.display = x && !onPlot ? "" : "none";
    if (x && onPlot) {
      setC(dot, x);
      guides.setAttribute("d", `M${sx(x[0])},${sy(x[1])} V${sy(0)} M${sx(x[0])},${sy(x[1])} H${sx(0)}`);
      const dirs = [0, 1].map(j => { const e = eqs[j], n = Math.hypot(e.a, e.b); return [-e.b / n, e.a / n] as P2; });
      const hs = hpos.flat();
      let best: P2 = [x[0] + 0.9, x[1] + 0.9], bestS = -Infinity;
      for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
        const v: P2 = [s1 * dirs[0][0] + s2 * dirs[1][0], s1 * dirs[0][1] + s2 * dirs[1][1]], vn = Math.hypot(...v);
        if (vn < 1e-6) continue;
        const half = Math.acos(Math.min(1, Math.abs(dirs[0][0] * v[0] + dirs[0][1] * v[1]) / vn));
        const q: P2 = [x[0] + 1.5 * v[0] / vn, x[1] + 1.5 * v[1] / vn];
        const clear = Math.min(1.5 * Math.sin(half), ...hs.map(h => Math.hypot(h[0] - q[0], h[1] - q[1]) - 0.6));
        const sc = clear - (Math.abs(q[0]) > HI - 1.2 || Math.abs(q[1]) > HI - 0.4 ? 5 : 0);
        if (sc > bestS) { bestS = sc; best = q; }
      }
      dotLab.setAttribute("x", String(sx(best[0])));
      dotLab.setAttribute("y", String(sy(best[1]) + 7));
      dotLab.setAttribute("text-anchor", "middle");
      dotLab.textContent = `(${fmt(x[0], 2)}, ${fmt(x[1], 2)})`;
    } else if (x) {
      // arrow at the edge, pointing towards the far-away crossing
      const L = Math.max(Math.abs(x[0]), Math.abs(x[1])), e = HI - 0.5;
      const tip: P2 = [x[0] / L * e, x[1] / L * e], nn = Math.hypot(x[0], x[1]);
      const u: P2 = [x[0] / nn, x[1] / nn], w = 0.35;
      const base: P2 = [tip[0] - 0.8 * u[0], tip[1] - 0.8 * u[1]];
      const pts = [tip, [base[0] - w * u[1], base[1] + w * u[0]], [base[0] + w * u[1], base[1] - w * u[0]]] as P2[];
      offArrow.setAttribute("d", "M" + pts.map(p => `${sx(p[0])},${sy(p[1])}`).join(" L") + "Z");
      offLab.setAttribute("x", String(sx(LO) + 10));
      offLab.setAttribute("y", String(sy(LO) - 14));
      offLab.textContent = `crossing off the plot, at (${fmt(x[0], 2)}, ${fmt(x[1], 2)})`;
    }

    // in-plot note for an equation that is not a line
    const notes: [string, string][] = [];
    for (const i of [0, 1]) {
      const e = eqs[i];
      if (Math.abs(e.a) < 1e-12 && Math.abs(e.b) < 1e-12)
        notes.push([`R${i + 1} is no line: 0 = ${fmt(e.c)}${Math.abs(e.c) < 1e-12 ? " (always true)" : " (never true)"}`, COL[i]]);
    }
    [msg, msg2].forEach((t, j) => { t.textContent = notes[j]?.[0] ?? ""; t.setAttribute("fill", notes[j]?.[1] ?? "#000"); });

    for (const i of [0, 1]) eqTxt[i].textContent = eqText(eqs[i]);
    statusText(res);
  }

  function statusText(res: Result): void {
    const col = KIND[res.kind];
    status.style.borderColor = col;
    sTitle.style.color = col;
    const e1 = eqs[0], e2 = eqs[1];
    const xn = (j: 0 | 1) => "x" + SUB[j];
    if (res.kind === "unique") {
      const x = res.x!;
      sTitle.textContent = `Unique solution (x₁, x₂) = (${fmt(x[0], 2)}, ${fmt(x[1], 2)})`;
      // how far the crossing moves when c2 changes by one slider step
      const y = classify(e1, { ...e2, c: e2.c + RANGE.c[2] }).x!;
      const mv = Math.hypot(y[0] - x[0], y[1] - x[1]);
      const ang = res.angle!;
      sWhy.innerHTML = (ang < 10
        ? `<b>Almost parallel</b> (angle ${fmt(ang, 1)}°): the crossing point is very sensitive and jumps far away.`
        : `The lines cross at exactly one point (angle ${fmt(ang, 0)}°).`)
        + `<br>Changing c₂ by 0.5 moves the crossing by ${fmt(mv, 2)}.`;
    } else if (res.kind === "none") {
      sTitle.textContent = "No solution";
      if (res.why === "impossible") {
        const k = res.zeroRow!;
        sWhy.innerHTML = `R${k + 1} has no x₁ and no x₂: it reads 0 = ${fmt(eqs[k].c)}, which is never true.`;
      } else if (Math.abs(e1.b) > 1e-12) {
        sWhy.innerHTML = `Parallel lines: the same slope −a/b = ${fmt(-e1.a / e1.b, 2)}, but they cross the x₂-axis at `
          + `<span class="c0">${fmt(e1.c / e1.b, 2)}</span> and <span class="c1">${fmt(e2.c / e2.b, 2)}</span>. They never meet.`;
      } else {
        sWhy.innerHTML = `Parallel vertical lines: <span class="c0">x₁ = ${fmt(e1.c / e1.a, 2)}</span> and `
          + `<span class="c1">x₁ = ${fmt(e2.c / e2.a, 2)}</span>. They never meet.`;
      }
    } else {
      sTitle.textContent = "Infinitely many solutions";
      if (res.why === "same") {
        const q: 0 | 1 = res.pivot === 0 ? 1 : 0;
        sWhy.innerHTML = `The same line: R2 = ${fmtFrac(res.m!)} × R1. Elimination leaves 0 = 0, so ${xn(q)} is free: `
          + `every point on the line is a solution.`;
      } else if (res.why === "noconstraint") {
        const k = res.zeroRow!;
        sWhy.innerHTML = `R${k + 1} reads 0 = 0: true for every (x₁, x₂), so it adds nothing. `
          + `Every point on line R${2 - k} is a solution.`;
      } else {
        sWhy.innerHTML = "Both equations read 0 = 0: every point of the plane is a solution.";
      }
    }
    ro.innerHTML = elimText(res);
  }

  function elimText(res: Result): string {
    const e1 = eqs[0];
    if (res.zeroRow !== null) {
      const k = res.zeroRow;
      return `R${k + 1}: 0x₁ + 0x₂ = ${fmt(eqs[k].c)}  (no unknowns left)\n`
        + (Math.abs(eqs[k].c) < 1e-12 ? "0 = 0 is always true." : `0 = ${fmt(eqs[k].c)} is impossible.`);
    }
    const p = res.pivot!, q: 0 | 1 = p === 0 ? 1 : 0, m = res.m!, red = res.red!;
    const xp = "x" + SUB[p], xq = "x" + SUB[q];
    const lines: string[] = [];
    if (p === 1) lines.push(`R1 has no x₁, so use R1 to eliminate x₂.`);
    const op = Math.abs(m) < 1e-12 ? null
      : `R2 ${m > 0 ? "−" : "+"} ${Math.abs(m - 1) < 1e-12 || Math.abs(m + 1) < 1e-12 ? "" : (Math.abs(m - Math.round(m)) < 1e-9 ? `${fmt(Math.abs(m))}·` : `(${fmtFrac(Math.abs(m))})·`)}R1`;
    const row = `${fmt(red.a)}x₁ ${red.b < 0 ? "−" : "+"} ${fmt(Math.abs(red.b))}x₂ = ${fmt(red.c)}`;
    lines.push(op ? `${op}:  <b>${row}</b>` : `R2 has no ${xp} already:  <b>${row}</b>`);
    if (res.kind === "unique") {
      const L = p === 0 ? red.b : red.a, x = res.x!;
      lines.push(`${xq} = ${fmt(red.c)} / ${fmt(L)} = ${fmt(x[q], 3)};  back into R1: ${xp} = ${fmt(x[p], 3)}`);
    } else if (res.kind === "none") {
      lines.push(`0 = ${fmt(red.c)} is impossible: no (x₁, x₂) works.`);
    } else {
      lines.push(`0 = 0 is always true: ${xq} is free, ${xp} = (${fmt(e1.c)} − ${fmt(p === 0 ? e1.b : e1.a)}·${xq}) / ${fmt(p === 0 ? e1.a : e1.b)}.`);
    }
    return lines.join("\n");
  }

  function setLine(l: SVGLineElement, a: P2, b: P2): void {
    l.setAttribute("x1", String(sx(a[0]))); l.setAttribute("y1", String(sy(a[1])));
    l.setAttribute("x2", String(sx(b[0]))); l.setAttribute("y2", String(sy(b[1])));
  }
  function setC(c: SVGCircleElement, p: P2): void {
    c.setAttribute("cx", String(sx(p[0]))); c.setAttribute("cy", String(sy(p[1])));
  }
  const clampV = (v: number) => Math.max(LO + 0.4, Math.min(HI - 0.4, v));

  draw();
}

autoMount(NAME, mount);
