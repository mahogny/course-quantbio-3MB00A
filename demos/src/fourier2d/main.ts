// Fourier image filter. A 256 x 256 micrograph, its centred log-magnitude spectrum,
// and the image rebuilt from a masked spectrum. Masks: low-pass disc, high-pass,
// band-pass ring, "keep the largest x%" (compression), and free painting on the
// spectrum (erase/restore, mirrored so the result stays real). Optional stripe artefact.
// The forward FFT is computed once (again only when the stripe is toggled); each change
// of the mask runs one inverse FFT, at most once per animation frame.
// Auto-mounts on <div data-demo="fourier2d">. Optional: data-mode="low|high|band|top|all",
// data-r="20" (radius), data-stripe="1" (start with the stripe artefact).
import { htmlEl, slider, presets, checkbox, button, autoMount } from "../lib/ui";
import { fft2d, makeMask, magnitudeOrder, reconstruct, rmse, stripe, Mode } from "./fft";
// @ts-ignore -- esbuild inlines the image as a data URL
import cellUrl from "./cell256.png";

const NAME = "fourier2d";
const N = 256;
const CREDIT = "Image: transmission electron micrograph of a mesenchymal stem cell, Robert M. Hunt, CC BY 3.0, via Wikimedia Commons";
const KEEPS = [0.1, 0.2, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100];   // % for compression
const STRIPE = { kx: 16, ky: 10, amp: 0.15 };
const BRUSH = 4;   // paint radius in frequency units

const STYLE = `
[data-demo="${NAME}"] { gap: 1em; flex-wrap: wrap; }
[data-demo="${NAME}"] .f2-left { display: flex; flex-direction: column; gap: .5em; flex: 1 1 600px; min-width: 0; max-width: 900px; }
[data-demo="${NAME}"] .f2-imgs { display: flex; gap: 10px; }
[data-demo="${NAME}"] .f2-imgs figure { margin: 0; flex: 1 1 0; min-width: 0; max-width: 300px; }
[data-demo="${NAME}"] .f2-imgs figcaption { font-size: 18px; text-align: center; line-height: 1.2; min-height: 2.6em; margin: 0 0 .2em; color: var(--qb-fg); }
[data-demo="${NAME}"] .f2-imgs figcaption small { display: block; font-size: 15px; color: var(--qb-muted); }
[data-demo="${NAME}"] canvas { width: 100%; aspect-ratio: 1; display: block; border-radius: 3px; touch-action: none; }
[data-demo="${NAME}"] canvas.spec { cursor: crosshair; outline: 2px solid #ccc; }
[data-demo="${NAME}"] .f2-info { display: flex; gap: .8em; align-items: flex-start; flex-wrap: wrap; }
[data-demo="${NAME}"] .f2-info .qb-readout { flex: 0 0 auto; }
[data-demo="${NAME}"] .f2-info .qb-note { flex: 1 1 200px; }
[data-demo="${NAME}"] .qb-panel { flex: 1 1 220px; max-width: 320px; gap: .45em; }
[data-demo="${NAME}"] .qb-slider.off { opacity: .35; pointer-events: none; }
[data-demo="${NAME}"] .f2-row { display: flex; gap: .35em; align-items: center; flex-wrap: wrap; }
[data-demo="${NAME}"] .f2-credit { font-size: 13px; color: var(--qb-muted); }
.reveal [data-demo="${NAME}"] { font-size: 20px; }
.reveal [data-demo="${NAME}"] .qb-readout { font-size: 18px; }
.reveal [data-demo="${NAME}"] .qb-note { font-size: 16px; }
.reveal [data-demo="${NAME}"] .f2-imgs figcaption { font-size: 19px; }
.reveal [data-demo="${NAME}"] .f2-imgs figcaption small { font-size: 16px; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

/** Decode the inlined PNG into grey levels 0..1 (row-major, row 0 at the top). */
function loadImage(url: string): Promise<Float64Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = N; c.height = N;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      const out = new Float64Array(N * N);
      for (let k = 0; k < N * N; k++) out[k] = d[4 * k] / 255;
      resolve(out);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function mkFigure(parent: Element, title: string, sub: string, cls = ""): HTMLCanvasElement {
  const fig = htmlEl("figure", "", "", parent);
  const cap = htmlEl("figcaption", "", title, fig);
  htmlEl("small", "", sub, cap);
  const c = htmlEl("canvas", cls, "", fig);
  c.width = N; c.height = N;
  return c;
}

/** Paint a grey image (values clamped to 0..1) into a canvas. */
function paintGrey(c: HTMLCanvasElement, v: ArrayLike<number>): void {
  const ctx = c.getContext("2d")!;
  const id = ctx.createImageData(N, N);
  for (let k = 0; k < N * N; k++) {
    const g = Math.round(255 * Math.min(1, Math.max(0, v[k])));
    id.data[4 * k] = id.data[4 * k + 1] = id.data[4 * k + 2] = g; id.data[4 * k + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function mount(host: HTMLElement): void {
  injectStyle();
  const left = htmlEl("div", "f2-left", "", host);
  const imgs = htmlEl("div", "f2-imgs", "", left);
  const cOrig = mkFigure(imgs, "original", "pixel brightness");
  const cSpec = mkFigure(imgs, "spectrum", "centre = low frequencies", "spec");
  const cOut = mkFigure(imgs, "filtered", "rebuilt from the kept part");
  const info = htmlEl("div", "f2-info", "", left);
  htmlEl("div", "f2-credit", CREDIT, left);
  const panel = htmlEl("div", "qb-panel", "", host);

  const mode0 = (host.dataset.mode ?? "low") as Mode;
  const st = {
    mode: (["all", "low", "high", "band", "top"].includes(mode0) ? mode0 : "low") as Mode,
    r: Number(host.dataset.r ?? 20), w: 12, keepIdx: 5, stripe: host.dataset.stripe === "1",
    brush: 0 as 0 | 1, edited: false,
  };
  const r0 = st.r;

  // ---- controls ----
  const modeLabels: [Mode, string][] = [["all", "no filter"], ["low", "low-pass"], ["high", "high-pass"],
    ["band", "band-pass"], ["top", "keep largest"]];
  const modeBtns = presets(panel, modeLabels.map(([m, label]) => ({ label, apply: () => { st.mode = m; rebuild(); } })));
  const rS = slider(panel, "radius r", 0, 128, 1, st.r, v => { st.r = v; rebuild(); });
  const wS = slider(panel, "ring width", 2, 60, 1, st.w, v => { st.w = v; rebuild(); });
  const kS = slider(panel, "keep %", 0, KEEPS.length - 1, 1, st.keepIdx, v => { st.keepIdx = v; rebuild(); },
    v => KEEPS[v] + "%");
  const stripeBox = checkbox(panel, "add stripe artefact", st.stripe, on => { st.stripe = on; forward(); rebuild(); });
  const brushRow = htmlEl("div", "f2-row", "", panel);
  htmlEl("span", "", "paint:", brushRow);
  const brushBtns = presets(brushRow, [
    { label: "erase", apply: () => { st.brush = 0; } },
    { label: "restore", apply: () => { st.brush = 1; } },
  ]);
  brushBtns[0].classList.add("active");
  button(brushRow, "reset", () => {
    st.mode = mode0; st.r = r0; st.w = 12; st.keepIdx = 5; st.brush = 0;
    rS.set(st.r); wS.set(st.w); kS.set(st.keepIdx);
    brushBtns.forEach((b, i) => b.classList.toggle("active", i === 0));
    if (st.stripe !== (host.dataset.stripe === "1")) {
      st.stripe = host.dataset.stripe === "1"; stripeBox.checked = st.stripe; forward();
    }
    rebuild();
  });
  const ro = htmlEl("div", "qb-readout", "", info);
  htmlEl("div", "qb-note", "Dark red = coefficients set to 0. Drag on the spectrum to erase or restore; the mirror point changes too, so the image stays real. The error is measured against the original without the stripe.", info);

  // ---- state ----
  let clean: Float64Array = new Float64Array(N * N);
  let img: Float64Array = clean;
  let Fre: Float64Array = new Float64Array(N * N), Fim: Float64Array = new Float64Array(N * N);
  let order: Uint32Array | null = null;
  let logMag: Float64Array = new Float64Array(N * N), lo = 0, hi = 1, totalE = 1;
  let mask: Uint8Array = new Uint8Array(N * N).fill(1);

  function forward(): void {
    img = Float64Array.from(clean);
    if (st.stripe) {
      const s = stripe(N, STRIPE.kx, STRIPE.ky, STRIPE.amp);
      for (let k = 0; k < N * N; k++) img[k] += s[k];
    }
    Fre = Float64Array.from(img); Fim = new Float64Array(N * N);
    fft2d(Fre, Fim, N);
    order = magnitudeOrder(Fre, Fim);
    lo = Infinity; hi = -Infinity; totalE = 0;
    for (let k = 0; k < N * N; k++) {
      const m2 = Fre[k] * Fre[k] + Fim[k] * Fim[k];
      logMag[k] = Math.log(1 + Math.sqrt(m2));
      if (k === 0) continue;                       // the centre (average) would wash out the scale
      totalE += m2;
      if (logMag[k] < lo) lo = logMag[k];
      if (logMag[k] > hi) hi = logMag[k];
    }
    lo = lo + 0.15 * (hi - lo);                     // a little contrast stretch
    paintGrey(cOrig, img);
  }

  function rebuild(): void {
    st.edited = false;
    mask = makeMask(N, st.mode, st.r, st.w, KEEPS[st.keepIdx] / 100, order);
    modeBtns.forEach((b, i) => b.classList.toggle("active", modeLabels[i][0] === st.mode));
    schedule();
  }

  let pending = false;
  function schedule(): void {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  }

  function draw(): void {
    rS.input.parentElement!.classList.toggle("off", !["low", "high", "band"].includes(st.mode));
    wS.input.parentElement!.classList.toggle("off", st.mode !== "band");
    kS.input.parentElement!.classList.toggle("off", st.mode !== "top");
    // spectrum, shifted so frequency 0 is in the middle; removed coefficients dim and red
    const ctx = cSpec.getContext("2d")!;
    const id = ctx.createImageData(N, N);
    let kept = 0, keptE = 0;
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const k = row * N + col;
        if (mask[k]) {
          kept++;
          if (k) keptE += Fre[k] * Fre[k] + Fim[k] * Fim[k];
        }
        const v = Math.min(1, Math.max(0, (logMag[k] - lo) / (hi - lo)));
        const drow = (row + N / 2) % N, dcol = (col + N / 2) % N;
        const p = 4 * (drow * N + dcol);
        if (mask[k]) { const g = Math.round(255 * v); id.data[p] = id.data[p + 1] = id.data[p + 2] = g; }
        else { id.data[p] = 90 + Math.round(130 * v); id.data[p + 1] = id.data[p + 2] = 20 + Math.round(60 * v); }
        id.data[p + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    if (st.stripe) {   // ring the stripe's two coefficients (one pixel each) while they are kept
      ctx.strokeStyle = "#ffd400"; ctx.lineWidth = 1.6;
      for (const sgn of [1, -1]) {
        const fx = sgn * STRIPE.kx, fy = sgn * STRIPE.ky;
        if (!mask[((fy + N) % N) * N + ((fx + N) % N)]) continue;
        ctx.beginPath(); ctx.arc(N / 2 + fx + 0.5, N / 2 + fy + 0.5, 7, 0, 2 * Math.PI); ctx.stroke();
      }
    }
    const out = reconstruct(Fre, Fim, mask, N);
    paintGrey(cOut, out);
    const pct = 100 * kept / (N * N);
    ro.textContent =
      `kept: ${fmtPct(pct)} of ${N * N} coefficients\n` +
      `variation kept: ${fmtPct(100 * keptE / totalE)}\n` +
      `RMS error: ${rmse(out, clean).toFixed(3)} (grey 0–1)` + (st.edited ? "  (mask painted)" : "");
  }

  // ---- painting on the spectrum ----
  function paintAt(ev: PointerEvent): void {
    const rect = cSpec.getBoundingClientRect();
    const dcol = Math.floor((ev.clientX - rect.left) / rect.width * N);
    const drow = Math.floor((ev.clientY - rect.top) / rect.height * N);
    const fx0 = dcol - N / 2, fy0 = drow - N / 2;
    for (let dy = -BRUSH; dy <= BRUSH; dy++) for (let dx = -BRUSH; dx <= BRUSH; dx++) {
      if (dx * dx + dy * dy > BRUSH * BRUSH) continue;
      for (const s of [1, -1]) {                       // the point and its mirror image
        const fx = s * (fx0 + dx), fy = s * (fy0 + dy);
        if (fx < -N / 2 || fx >= N / 2 || fy < -N / 2 || fy >= N / 2) continue;
        mask[((fy + N) % N) * N + ((fx + N) % N)] = st.brush;
      }
    }
    st.edited = true;
    schedule();
  }
  cSpec.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    try { cSpec.setPointerCapture(ev.pointerId); } catch { /* synthetic event */ }
    paintAt(ev);
    const move = (e: PointerEvent) => paintAt(e);
    const up = () => {
      cSpec.removeEventListener("pointermove", move);
      cSpec.removeEventListener("pointerup", up);
      cSpec.removeEventListener("pointercancel", up);
    };
    cSpec.addEventListener("pointermove", move);
    cSpec.addEventListener("pointerup", up);
    cSpec.addEventListener("pointercancel", up);
  });

  loadImage(cellUrl as string).then(v => { clean = v; forward(); rebuild(); });
}

function fmtPct(p: number): string {
  return (p >= 99.95 && p < 100 ? "99.9" : p >= 10 ? p.toFixed(1).replace(/\.0$/, "") : p >= 1 ? p.toFixed(1) : p.toFixed(2)) + "%";
}

autoMount(NAME, mount);
