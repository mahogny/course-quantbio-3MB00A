// Pure maths for the "many plausible lines" demo (no DOM), so it can be tested with node.
// Same donors and model as the MCMC demo (demos/src/mcmc/model.ts):
//   expression = a + b * (age - 50) / 10 + noise,  noise ~ Normal(0, SIGMA^2), SIGMA known,
// so a = expression at age 50 and b = change per 10 years.
// Priors: flat on a, Normal(0, w^2) on the slope b (w = Infinity means flat).
// With a known noise scale this posterior is exactly a 2D Normal (conjugate), so draws,
// bands and P(slope > 0) are computed exactly, without a sampler.
import { AGES, EXPR, SIGMA } from "../mcmc/model";

export { AGES, EXPR, SIGMA };

/** Order in which donors are added by the "donors" slider: spread over the age range early. */
export const ORDER = [4, 10, 0, 7, 2, 9, 5, 11, 1, 8, 3, 6];

export const toX = (age: number): number => (age - 50) / 10;

export interface Post {
  ma: number; mb: number;            // posterior mean of a and b
  saa: number; sbb: number; sab: number; // posterior covariance
}

/** Donor indices used with the first n of ORDER (2 <= n <= 12). */
export function usedDonors(n: number): number[] {
  return ORDER.slice(0, Math.max(2, Math.min(ORDER.length, Math.round(n))));
}

/** Exact posterior for the donors `idx`, slope prior width w (per 10 years). */
export function posterior(idx: number[], w: number, sigma = SIGMA): Post {
  let n = 0, sx = 0, sxx = 0, sy = 0, sxy = 0;
  for (const i of idx) {
    const x = toX(AGES[i]), y = EXPR[i];
    n++; sx += x; sxx += x * x; sy += y; sxy += x * y;
  }
  const s2 = sigma * sigma;
  const p11 = n / s2, p12 = sx / s2, p22 = sxx / s2 + (Number.isFinite(w) ? 1 / (w * w) : 0);
  const det = p11 * p22 - p12 * p12;
  const saa = p22 / det, sbb = p11 / det, sab = -p12 / det;
  const r1 = sy / s2, r2 = sxy / s2;
  return { ma: saa * r1 + sab * r2, mb: sab * r1 + sbb * r2, saa, sbb, sab };
}

/** Least-squares line (= posterior peak with flat priors). */
export function bestLine(idx: number[]): [number, number] {
  const p = posterior(idx, Infinity);
  return [p.ma, p.mb];
}

/** Total squared miss of the line (a, b) over the donors idx. */
export function sumSq(idx: number[], a: number, b: number): number {
  let ss = 0;
  for (const i of idx) { const r = EXPR[i] - a - b * toX(AGES[i]); ss += r * r; }
  return ss;
}

/** Likelihood of (a, b) relative to the best line: exp(-(SS - SSmin) / (2 sigma^2)), in [0, 1]. */
export function relLik(idx: number[], a: number, b: number, sigma = SIGMA): number {
  const [a0, b0] = bestLine(idx);
  return Math.exp(-(sumSq(idx, a, b) - sumSq(idx, a0, b0)) / (2 * sigma * sigma));
}

/** Turn standard-normal pairs z into posterior draws (Cholesky), so lines morph smoothly. */
export function draws(p: Post, z: [number, number][]): [number, number][] {
  const l11 = Math.sqrt(p.saa), l21 = p.sab / l11, l22 = Math.sqrt(Math.max(0, p.sbb - l21 * l21));
  return z.map(([u, v]) => [p.ma + l11 * u, p.mb + l21 * u + l22 * v]);
}

/** Posterior mean and SD of the line height at age; `pred` adds the noise of one new donor. */
export function bandAt(p: Post, age: number, pred: boolean, sigma = SIGMA): [number, number] {
  const x = toX(age);
  const v = p.saa + 2 * x * p.sab + x * x * p.sbb + (pred ? sigma * sigma : 0);
  return [p.ma + p.mb * x, Math.sqrt(v)];
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf; error < 1.5e-7). */
export function pnorm(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const e = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    * Math.exp(-z * z / 2);
  return z >= 0 ? 0.5 * (1 + e) : 0.5 * (1 - e);
}

/** Exact P(slope > 0). */
export const probPos = (p: Post): number => pnorm(p.mb / Math.sqrt(p.sbb));
