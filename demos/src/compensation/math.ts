// Pure maths for the compensation demo (no DOM), so it can be tested with node.
import { rng } from "../lib/ui";

export type Group = "unstained" | "FITC+" | "PE+" | "FITC+ PE+";
export const GROUPS: Group[] = ["unstained", "PE+", "FITC+", "FITC+ PE+"];  // draw order

export interface Cells { group: Group[]; mx: Float64Array; my: Float64Array }  // measured detectors

/** 2×2 matrix, row-major [a, b, c, d] = [[a, b], [c, d]]. */
export type M2 = [number, number, number, number];

/** Spillover matrix in the lecture's convention: measured = S × true,
 *  S = [[1, s12], [s21, 1]]; s21 = FITC light in the PE detector, s12 = PE light in the FITC detector. */
export const spill = (s21: number, s12: number): M2 => [1, s12, s21, 1];

/** Inverse of a 2×2 matrix (swap the diagonal, negate the off-diagonal, divide by ad − bc). */
export function inv2([a, b, c, d]: M2): M2 {
  const k = a * d - b * c;
  return [d / k, -b / k, -c / k, a / k];
}

/** Simulate the lecture's four populations (same sizes and centres), measured = S × true + noise. */
export function simulate(S: M2, seed = 1): Cells {
  const r = rng(seed);
  const spec: [Group, number, number, number][] = [
    ["unstained", 600, 100, 100], ["FITC+", 400, 3000, 100], ["PE+", 400, 100, 2000], ["FITC+ PE+", 200, 3000, 2000]];
  const n = spec.reduce((s, p) => s + p[1], 0);
  const group: Group[] = [], mx = new Float64Array(n), my = new Float64Array(n);
  let i = 0;
  for (const [g, m, f, p] of spec) for (let k = 0; k < m; k++, i++) {
    const tf = Math.exp(Math.log(f) + 0.3 * r.norm()), tp = Math.exp(Math.log(p) + 0.3 * r.norm());
    group.push(g);
    mx[i] = S[0] * tf + S[1] * tp + 30 * r.norm();
    my[i] = S[2] * tf + S[3] * tp + 30 * r.norm();
  }
  return { group, mx, my };
}

/** Apply a matrix to every cell. */
export function apply(M: M2, c: Cells): { x: Float64Array; y: Float64Array } {
  const n = c.mx.length, x = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = M[0] * c.mx[i] + M[1] * c.my[i]; y[i] = M[2] * c.mx[i] + M[3] * c.my[i]; }
  return { x, y };
}

export function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

/** Least-squares line y = a + b x. */
export function lsLine(x: number[], y: number[]): { a: number; b: number } {
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Pick the values of one population. */
export function pick(v: Float64Array, c: Cells, g: Group): number[] {
  const out: number[] = [];
  c.group.forEach((h, i) => { if (h === g) out.push(v[i]); });
  return out;
}

/** Summary of the compensated data: trend of each single-positive population and the medians. */
export function summary(c: Cells, x: Float64Array, y: Float64Array) {
  const fx = pick(x, c, "FITC+"), fy = pick(y, c, "FITC+");
  const px = pick(x, c, "PE+"), py = pick(y, c, "PE+");
  return {
    fitc: lsLine(fx, fy),            // PE as a function of FITC, for FITC+ cells
    pe: lsLine(py, px),              // FITC as a function of PE, for PE+ cells
    fitcRange: [Math.min(...fx), Math.max(...fx)],
    peRange: [Math.min(...py), Math.max(...py)],
    medFitcPE: median(fy), medPeFITC: median(px),
    medUnX: median(pick(x, c, "unstained")), medUnY: median(pick(y, c, "unstained")),
    negFitcPE: fy.filter(v => v < 0).length / fy.length,
    negPeFITC: px.filter(v => v < 0).length / px.length,
  };
}
