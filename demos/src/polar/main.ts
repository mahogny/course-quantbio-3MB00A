// Polar: move the centre. The plate photo from the polar unit, a draggable centre, and two
// live panels: the image unwrapped around that centre (theta across, r up) and the radial
// profile (mean grey level at each r). Around the right centre the zone edge is a straight
// line in the strip and a sharp drop in the profile; off-centre it becomes a wave.
//
// Options (data-* on the host div):
//   data-disk="5"       disk to start with (numbering as in the lecture's plate figure)
//   data-disks="5 4 11 7" disks offered as buttons
//   data-offset="9 -6"  start this many pixels away from the table centre (x, y)
//   data-threshold="0.55"

// The import is inlined as a data URL by the build (esbuild --loader:.jpg=dataurl).
// @ts-ignore -- no type declaration for image imports
import plateUrl from "./plate.jpg";
import { svgEl, htmlEl, slider, button, checkbox, numList, autoMount, setAttrs, svgPoint } from "../lib/ui";
import { Plate, unwrap, profile, edgeOf, edgePerAngle, bestCentre } from "./core";

// Disk centres in pixels, img[x, y] with y up (the table from the lecture and exercise).
const DISKS: [number, number][] = [[218, 508], [386, 511], [111, 403], [478, 413], [353, 356], [226, 306],
  [506, 275], [101, 247], [322, 220], [436, 147], [148, 113], [298, 82]];
const PX_PER_MM = 26.8 / 6;
const RMIN = 16;            // skip the paper disk itself, as in the R code
const MAX_SHIFT = 25;       // how far the centre may be dragged from the table centre

const STYLE = `
[data-demo="polar"] { flex-direction: column; gap: .5em; }
[data-demo="polar"] .pl-row { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; width: 100%; }
[data-demo="polar"] .pl-img { flex: 0 1 420px; min-width: 260px; }
[data-demo="polar"] .pl-plot { flex: 1 1 560px; min-width: 300px; max-width: 700px; }
[data-demo="polar"] .pl-controls { display: flex; flex-wrap: wrap; gap: .5em 1.2em; align-items: center; width: 100%; }
[data-demo="polar"] .pl-controls .qb-slider { min-width: 15em; }
[data-demo="polar"] .pl-controls .qb-readout { flex: 1 1 20em; margin: 0; }
[data-demo="polar"] svg text { font-size: 18px; }
[data-demo="polar"] .pl-strip { image-rendering: pixelated; }
.reveal [data-demo="polar"] { font-size: 19px; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-polar")) return;
  const s = document.createElement("style");
  s.id = "qb-style-polar";
  s.textContent = STYLE;
  document.head.appendChild(s);
}

/** Text with a white halo (a white-stroked copy underneath), readable on top of the photo. */
function haloText(parent: Element, text: string, colour: string, anchor: string) {
  const g = svgEl("g", {}, parent);
  const back = svgEl("text", { "text-anchor": anchor, "font-weight": 600,
    style: "fill:#fff;stroke:#fff;stroke-width:5px;stroke-linejoin:round" }, g);
  const front = svgEl("text", { "text-anchor": anchor, "font-weight": 600, style: `fill:${colour}` }, g);
  const set = (t: string) => { back.textContent = t; front.textContent = t; };
  set(text);
  return { set, move: (x: number, y: number) => g.setAttribute("transform", `translate(${x} ${y})`) };
}

function loadPlate(url: string): Promise<Plate> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const data = new Float32Array(c.width * c.height);
      for (let i = 0; i < data.length; i++) data[i] = d[4 * i] / 255;
      resolve({ w: c.width, h: c.height, data });
    };
    im.onerror = reject;
    im.src = url;
  });
}

function mount(host: HTMLElement): void {
  injectStyle();
  const disksOffered = numList(host.dataset.disks, [5, 4, 11, 7]).filter(d => d >= 1 && d <= 12);
  const startDisk = numList(host.dataset.disk, [disksOffered[0] ?? 5])[0];
  const offset = numList(host.dataset.offset, [9, -6]);
  const thr0 = numList(host.dataset.threshold, [0.55])[0];

  // ---- state ----
  let disk = startDisk;
  let rmax = 80;
  let x0 = 0, y0 = 0;              // the centre, in plate pixels (y up)
  let thr = thr0;
  let markClear = true;
  let best: [number, number] = [0, 0];
  let bestProf: number[] = [];
  let plate: Plate | null = null;

  // ---- layout ----
  const row = htmlEl("div", "pl-row", "", host);
  const IW = 420, PAD = 6, VIEW = IW - 2 * PAD;
  const imgSvg = svgEl("svg", { viewBox: `0 0 ${IW} ${IW}`, class: "pl-img", role: "img",
    "aria-label": "plate photo with a draggable centre" }, row);
  const PW = 690, PH = 440;
  const plotSvg = svgEl("svg", { viewBox: `0 0 ${PW} ${PH}`, class: "pl-plot", role: "img",
    "aria-label": "unwrapped strip and radial profile" }, row);
  const controls = htmlEl("div", "pl-controls", "", host);

  // image panel
  const clipId = "pl-clip-" + Math.random().toString(36).slice(2, 8);
  const defs = svgEl("defs", {}, imgSvg);
  svgEl("rect", { x: PAD, y: PAD, width: VIEW, height: VIEW }, svgEl("clipPath", { id: clipId }, defs));
  const imgG = svgEl("g", { "clip-path": `url(#${clipId})` }, imgSvg);
  svgEl("rect", { x: PAD, y: PAD, width: VIEW, height: VIEW, fill: "#ddd" }, imgG);
  const plateImg = svgEl("image", { href: plateUrl, preserveAspectRatio: "none" }, imgG);
  const ringIn = svgEl("circle", { fill: "none", stroke: "#17becf", "stroke-width": 2, "stroke-dasharray": "6 5" }, imgG);
  const ringOut = svgEl("circle", { fill: "none", stroke: "#17becf", "stroke-width": 2.5, "stroke-dasharray": "6 5" }, imgG);
  const ray0 = svgEl("line", { stroke: "#17becf", "stroke-width": 2 }, imgG);
  const ray90 = svgEl("line", { stroke: "#17becf", "stroke-width": 2 }, imgG);
  const lab0 = haloText(imgG, "0°", "#0b7f8a", "middle");
  const lab90 = haloText(imgG, "90°", "#0b7f8a", "middle");
  const edgeCurve = svgEl("polygon", { fill: "none", stroke: "#d62728", "stroke-width": 3 }, imgG);
  const handle = svgEl("g", {}, imgG);
  svgEl("circle", { r: 17, fill: "rgba(255,255,255,0.35)", stroke: "#d62728", "stroke-width": 3.5 }, handle);
  svgEl("line", { x1: -9, x2: 9, y1: 0, y2: 0, stroke: "#d62728", "stroke-width": 3 }, handle);
  svgEl("line", { x1: 0, x2: 0, y1: -9, y2: 9, stroke: "#d62728", "stroke-width": 3 }, handle);
  const rangeLab = haloText(imgSvg, "", "#0b7f8a", "start");
  rangeLab.move(PAD + 8, IW - PAD - 10);
  const diskLab = haloText(imgSvg, "", "#222", "start");
  diskLab.move(PAD + 8, PAD + 24);
  svgEl("rect", { x: PAD, y: PAD, width: VIEW, height: VIEW, fill: "none", stroke: "#888" }, imgSvg);
  // the whole image is the drag target: press anywhere to move the centre there
  const hit = svgEl("rect", { x: PAD, y: PAD, width: VIEW, height: VIEW, fill: "transparent",
    style: "cursor: crosshair; touch-action: none" }, imgSvg);

  // crop window <-> screen
  let cropX = 0, cropY = 0, H = 100, sc = 1;     // crop centre (table centre), half-size, scale
  const toScreen = (x: number, y: number): [number, number] =>
    [PAD + (x - (cropX - H)) * sc, PAD + ((cropY + H) - y) * sc];
  const toPlate = (sx: number, sy: number): [number, number] =>
    [(sx - PAD) / sc + cropX - H, cropY + H - (sy - PAD) / sc];

  // plot panel
  const L = 70, R = PW - 26, sx = (t: number) => L + t / 360 * (R - L);
  const ST = 8, SB = 186;                         // strip top / bottom
  const PT = 262, PB = 384;                       // profile top / bottom
  const strip = svgEl("image", { x: L, y: ST, width: R - L, height: SB - ST, preserveAspectRatio: "none", class: "pl-strip" }, plotSvg);
  svgEl("rect", { x: L, y: ST, width: R - L, height: SB - ST, fill: "none", stroke: "#888" }, plotSvg);
  const edgeLine = svgEl("polyline", { fill: "none", stroke: "#d62728", "stroke-width": 2.5 }, plotSvg);
  for (const t of [0, 90, 180, 270, 360]) {
    svgEl("line", { x1: sx(t), x2: sx(t), y1: SB, y2: SB + 6, class: "axis" }, plotSvg);
    const tx = svgEl("text", { x: sx(t), y: SB + 25, "text-anchor": "middle" }, plotSvg);
    tx.textContent = String(t);
  }
  const stripXLab = svgEl("text", { x: (L + R) / 2, y: SB + 50, "text-anchor": "middle" }, plotSvg);
  stripXLab.textContent = "θ (degrees), counter-clockwise from the x direction";
  const stripYTicks = svgEl("g", {}, plotSvg);
  const stripYLab = svgEl("text", { transform: `translate(18 ${(ST + SB) / 2}) rotate(-90)`, "text-anchor": "middle" }, plotSvg);
  stripYLab.textContent = "r (px)";

  const profG = svgEl("g", {}, plotSvg);
  svgEl("rect", { x: L, y: PT, width: R - L, height: PB - PT, fill: "none", stroke: "#888" }, plotSvg);
  const profYLab = svgEl("text", { transform: `translate(18 ${(PT + PB) / 2}) rotate(-90)`, "text-anchor": "middle" }, plotSvg);
  profYLab.textContent = "mean grey";
  for (const v of [0, 0.5, 1]) {
    const y = PB - v * (PB - PT);
    svgEl("line", { x1: L - 6, x2: L, y1: y, y2: y, class: "axis" }, plotSvg);
    const tx = svgEl("text", { x: L - 10, y: y + 6, "text-anchor": "end" }, plotSvg);
    tx.textContent = String(v);
  }
  const profXTicks = svgEl("g", {}, plotSvg);
  const profXLab = svgEl("text", { x: (L + R) / 2, y: PB + 50, "text-anchor": "middle" }, plotSvg);
  profXLab.textContent = "r (pixels from the centre)";

  // ---- controls ----
  const diskRow = htmlEl("div", "qb-presets", "", controls);
  const diskBtns = disksOffered.map(d => {
    const b = button(diskRow, "disk " + d, () => { setDisk(d, [0, 0]); });
    b.dataset.disk = String(d);
    return b;
  });
  const thrSlider = slider(controls, "threshold", 0.3, 0.8, 0.01, thr, v => { thr = v; schedule(); });
  checkbox(controls, "mark clear pixels", markClear, v => { markClear = v; schedule(); });
  const btnRow = htmlEl("div", "qb-presets", "", controls);
  button(btnRow, "snap to best centre", () => {
    if (!plate) return;
    [x0, y0] = clampCentre(...bestCentre(plate, x0, y0, rmax));
    schedule();
  });
  button(btnRow, "reset", () => { thr = thr0; thrSlider.set(thr0); setDisk(startDisk, offset); });
  const readout = htmlEl("div", "qb-readout", "loading the plate…", controls);

  function clampCentre(x: number, y: number): [number, number] {
    return [Math.max(cropX - MAX_SHIFT, Math.min(cropX + MAX_SHIFT, x)),
      Math.max(cropY - MAX_SHIFT, Math.min(cropY + MAX_SHIFT, y))];
  }

  function setDisk(d: number, off: number[]): void {
    disk = d;
    rmax = d === 4 ? 100 : 80;
    [cropX, cropY] = DISKS[d - 1];
    H = rmax + 20;
    sc = VIEW / (2 * H);
    [x0, y0] = clampCentre(cropX + (off[0] ?? 0), cropY + (off[1] ?? 0));
    diskBtns.forEach(b => b.classList.toggle("active", b.dataset.disk === String(d)));
    // the plate photo, placed so that pixel (x, y) covers [x - 0.5, x + 0.5] x [y - 0.5, y + 0.5]
    const [ix, iy] = toScreen(0.5, 600.5);
    setAttrs(plateImg, { x: ix, y: iy, width: 600 * sc, height: 600 * sc });
    diskLab.set(`disk ${d}`);
    rangeLab.set(`dashed circles: r = ${RMIN} and r = ${rmax}`);
    // axis ticks that depend on rmax
    stripYTicks.replaceChildren();
    profXTicks.replaceChildren();
    for (let r = 0; r <= rmax; r += rmax === 100 ? 25 : 20) {
      const y = SB - r / rmax * (SB - ST);
      if (r % (rmax === 100 ? 50 : 40) === 0) {
        svgEl("line", { x1: L - 6, x2: L, y1: y, y2: y, class: "axis" }, stripYTicks);
        const t = svgEl("text", { x: L - 10, y: y + 6, "text-anchor": "end" }, stripYTicks);
        t.textContent = String(r);
      }
      const x = L + r / rmax * (R - L);
      svgEl("line", { x1: x, x2: x, y1: PB, y2: PB + 6, class: "axis" }, profXTicks);
      const t = svgEl("text", { x, y: PB + 25, "text-anchor": "middle" }, profXTicks);
      t.textContent = String(r);
    }
    if (plate) {
      best = bestCentre(plate, cropX, cropY, rmax);
      bestProf = profile(unwrap(plate, best[0], best[1], rmax), rmax);
    }
    schedule();
  }

  // ---- drawing ----
  const stripCanvas = document.createElement("canvas");
  let pending = false;
  function schedule(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  }

  function draw(): void {
    const [hx, hy] = toScreen(x0, y0);
    handle.setAttribute("transform", `translate(${hx} ${hy})`);
    setAttrs(ringIn, { cx: hx, cy: hy, r: RMIN * sc });
    setAttrs(ringOut, { cx: hx, cy: hy, r: rmax * sc });
    setAttrs(ray0, { x1: hx, y1: hy, x2: hx + rmax * sc, y2: hy });
    setAttrs(ray90, { x1: hx, y1: hy, x2: hx, y2: hy - rmax * sc });
    lab0.move(hx + rmax * sc - 4, hy - 10);
    lab90.move(hx + 24, hy - rmax * sc + 16);
    if (!plate) return;

    const u = unwrap(plate, x0, y0, rmax);
    const prof = profile(u, rmax);
    const edges = edgePerAngle(u, rmax, thr);
    const e = edgeOf(prof, thr);

    // strip: theta across (one column per degree), r up (row 0 of the canvas is r = rmax)
    stripCanvas.width = 360; stripCanvas.height = rmax + 1;
    const ctx = stripCanvas.getContext("2d")!;
    const im = ctx.createImageData(360, rmax + 1);
    for (let r = 0; r <= rmax; r++) for (let t = 0; t < 360; t++) {
      const g = u[r * 360 + t], k = 4 * ((rmax - r) * 360 + t);
      const clear = markClear && r >= RMIN && g >= thr;
      im.data[k] = clear ? 120 + 135 * g : 255 * g;
      im.data[k + 1] = clear ? 100 + 120 * g : 255 * g;
      im.data[k + 2] = clear ? 40 * g : 255 * g;
      im.data[k + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    strip.setAttribute("href", stripCanvas.toDataURL());
    const sy = (r: number) => SB - (r + 0.5) / (rmax + 1) * (SB - ST);
    edgeLine.setAttribute("points", edges.map((r, t) => Number.isNaN(r) ? "" : `${sx(t + 0.5)},${sy(r)}`)
      .filter(s => s).join(" "));

    // edge on the plate: r(theta) as a closed curve
    edgeCurve.setAttribute("points", edges.map((r, t) => {
      const rr = Number.isNaN(r) ? rmax : r, a = t * Math.PI / 180;
      const [px, py] = toScreen(x0 + rr * Math.cos(a), y0 + rr * Math.sin(a));
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(" "));

    // profile
    profG.replaceChildren();
    const fx = (r: number) => L + r / rmax * (R - L);
    const fy = (v: number) => PB - Math.max(0, Math.min(1, v)) * (PB - PT);
    svgEl("line", { x1: L, x2: R, y1: fy(thr), y2: fy(thr), stroke: "#555", "stroke-width": 1.5, "stroke-dasharray": "6 5" }, profG);
    const tl = svgEl("text", { x: R - 6, y: fy(thr) - 6, "text-anchor": "end", style: "fill:#555" }, profG);
    tl.textContent = `threshold ${thr.toFixed(2)}`;
    if (bestProf.length) {
      svgEl("polyline", { points: bestProf.map((v, r) => `${fx(r)},${fy(v)}`).join(" "), fill: "none",
        stroke: "#bbb", "stroke-width": 4 }, profG);
    }
    svgEl("polyline", { points: prof.map((v, r) => `${fx(r)},${fy(v)}`).join(" "), fill: "none",
      stroke: "#222", "stroke-width": 2.5 }, profG);
    if (!Number.isNaN(e)) {
      svgEl("line", { x1: fx(e), x2: fx(e), y1: PT, y2: PB, stroke: "#d62728", "stroke-width": 2.5 }, profG);
      const t = svgEl("text", { x: fx(e) + (e > rmax * 0.7 ? -6 : 6), y: PT + 22, "text-anchor": e > rmax * 0.7 ? "end" : "start", style: "fill:#d62728" }, profG);
      t.textContent = `edge r = ${e}`;
    }
    const lg = svgEl("text", { x: L + 8, y: PB - 10, style: "fill:#888" }, profG);
    lg.textContent = "grey: at the best centre";

    // readout
    const ok = edges.filter(v => !Number.isNaN(v));
    const miss = edges.length - ok.length;
    const dist = Math.hypot(x0 - best[0], y0 - best[1]);
    const lines = [
      `centre (x0, y0) = (${x0.toFixed(1)}, ${y0.toFixed(1)}), ${dist.toFixed(1)} px from the best centre`,
      Number.isNaN(e) ? "profile: never below the threshold"
        : `profile edge: r = ${e} px → zone diameter ${(2 * e / PX_PER_MM).toFixed(1)} mm`,
      ok.length ? `edge per angle r(θ): ${Math.min(...ok)} to ${Math.max(...ok)} px (spread ${Math.max(...ok) - Math.min(...ok)} px)`
        + (miss ? `; no edge in ${miss}°` : "") : "edge per angle: none found",
    ];
    readout.textContent = lines.join("\n");
  }

  // ---- interaction ----
  const moveTo = (ev: PointerEvent) => {
    const [px, py] = toPlate(...svgPoint(imgSvg, ev));
    [x0, y0] = clampCentre(Math.round(px * 2) / 2, Math.round(py * 2) / 2);
    schedule();
  };
  hit.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    hit.setPointerCapture(ev.pointerId);
    moveTo(ev);
    const up = () => {
      hit.removeEventListener("pointermove", moveTo);
      hit.removeEventListener("pointerup", up);
      hit.removeEventListener("pointercancel", up);
    };
    hit.addEventListener("pointermove", moveTo);
    hit.addEventListener("pointerup", up);
    hit.addEventListener("pointercancel", up);
  });

  setDisk(startDisk, offset);
  loadPlate(plateUrl).then(p => { plate = p; setDisk(disk, [x0 - cropX, y0 - cropY]); })
    .catch(() => { readout.textContent = "could not read the plate image"; });
}

autoMount("polar", mount);
