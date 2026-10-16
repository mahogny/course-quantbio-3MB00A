// Pure maths for the polar demo (no DOM), so it can be tested with node.
// Coordinates follow the lecture: img[x, y] with x = 1..600 to the right and
// y = 1..600 UP; theta is counter-clockwise from the x direction, in degrees 0..359.

export interface Plate { w: number; h: number; data: Float32Array }   // data[row * w + col], row 0 = top

/** Grey level at the R pixel (x, y), as a plain lookup (x, y integers). */
export function px(p: Plate, x: number, y: number): number {
  const col = Math.min(p.w - 1, Math.max(0, x - 1));
  const row = Math.min(p.h - 1, Math.max(0, p.h - y));
  return p.data[row * p.w + col];
}

/** Bilinear interpolation between the four pixels around the point (x, y). */
export function bilinear(p: Plate, x: number, y: number): number {
  const x1 = Math.floor(x), y1 = Math.floor(y);
  const fx = x - x1, fy = y - y1;
  return (1 - fx) * (1 - fy) * px(p, x1, y1) + fx * (1 - fy) * px(p, x1 + 1, y1)
       + (1 - fx) * fy * px(p, x1, y1 + 1) + fx * fy * px(p, x1 + 1, y1 + 1);
}

/** The unwrapped strip: u[r * nTheta + t] for r = 0..rmax, theta = t * 360 / nTheta degrees. */
export function unwrap(p: Plate, x0: number, y0: number, rmax: number, nTheta = 360): Float32Array {
  const u = new Float32Array((rmax + 1) * nTheta);
  for (let t = 0; t < nTheta; t++) {
    const a = t * 2 * Math.PI / nTheta, c = Math.cos(a), s = Math.sin(a);
    for (let r = 0; r <= rmax; r++) u[r * nTheta + t] = bilinear(p, x0 + r * c, y0 + r * s);
  }
  return u;
}

/** Radial profile: mean over theta of each row of the strip (rowMeans(u) in R). */
export function profile(u: Float32Array, rmax: number, nTheta = 360): number[] {
  const out: number[] = [];
  for (let r = 0; r <= rmax; r++) {
    let s = 0;
    for (let t = 0; t < nTheta; t++) s += u[r * nTheta + t];
    out.push(s / nTheta);
  }
  return out;
}

/** First radius >= rmin whose value is below the threshold (as edge_of in R); NaN if none. */
export function edgeOf(v: ArrayLike<number>, thr: number, rmin = 16): number {
  for (let r = rmin; r < v.length; r++) if (v[r] < thr) return r;
  return NaN;
}

/**
 * The edge separately for every angle: r(theta), one value per column of the strip.
 * As edge_of in R, but first skip any dark pixels at r >= rmin: off-centre, the paper disk
 * itself reaches past r = 16 on one side and would otherwise be read as the edge.
 * At a good centre this gives the same answer as the R rule; skipDark = false is the R rule.
 */
export function edgePerAngle(u: Float32Array, rmax: number, thr: number, nTheta = 360, rmin = 16,
  skipDark = true): number[] {
  const out: number[] = [];
  for (let t = 0; t < nTheta; t++) {
    let r = rmin;
    if (skipDark) while (r <= rmax && u[r * nTheta + t] < thr) r++;   // still on the dark disk
    while (r <= rmax && u[r * nTheta + t] >= thr) r++;      // the clear zone
    out.push(r <= rmax ? r : NaN);
  }
  return out;
}

/** How far r(theta) is from flat: mean absolute deviation from its median (a missing edge counts as rmax). */
export function wobble(edges: number[], rmax: number): number {
  const e = edges.map(v => Number.isNaN(v) ? rmax : v);
  const m = [...e].sort((a, b) => a - b)[Math.floor(e.length / 2)];
  return e.reduce((s, v) => s + Math.abs(v - m), 0) / e.length;
}

/**
 * Snap to the best centre, in two steps:
 * 1. coarse: search a window around (x0, y0) for the darkest small disc (the paper disk);
 * 2. fine: around that point, find the centre where the zone edge r(theta) is flattest,
 *    at a few thresholds so the answer does not depend on the slider. Here the edge uses
 *    the plain R rule, so a centre off the paper disk (edge at r = 16 on one side) scores badly.
 */
export function bestCentre(p: Plate, x0: number, y0: number, rmax: number, search = 30): [number, number] {
  const nT = 120;
  const darkness = (x: number, y: number) => {     // dark inside r <= 10, bright at r = 16..22
    const u = unwrap(p, x, y, 22, 60);
    let inner = 0, outer = 0;
    for (let i = 0; i < 11 * 60; i++) inner += u[i];
    for (let i = 16 * 60; i < 23 * 60; i++) outer += u[i];
    return inner / (11 * 60) - outer / (7 * 60);
  };
  const flatness = (x: number, y: number) => {
    const u = unwrap(p, x, y, rmax, nT);
    let s = 0;
    for (const thr of [0.45, 0.55, 0.65]) s += wobble(edgePerAngle(u, rmax, thr, nT, 16, false), rmax);
    return s;
  };
  const argmin = (f: (x: number, y: number) => number, cx: number, cy: number, half: number, step: number) => {
    let bx = cx, by = cy, best = f(cx, cy);
    for (let dx = -half; dx <= half; dx += step) for (let dy = -half; dy <= half; dy += step) {
      const c = f(cx + dx, cy + dy);
      if (c < best - 1e-9) { best = c; bx = cx + dx; by = cy + dy; }
    }
    return [bx, by] as [number, number];
  };
  const [dx, dy] = argmin(darkness, Math.round(x0), Math.round(y0), search, 2);
  return argmin(flatness, dx, dy, 4, 0.5);
}
