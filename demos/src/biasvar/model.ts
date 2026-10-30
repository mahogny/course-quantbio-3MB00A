// Bias–variance model for the biasvar demo (no DOM, testable with node).
// A smooth "true" dose–response curve on dose 0..1, noisy training points at stratified doses,
// and a ridge-penalised degree-10 polynomial fit. The polynomial is written in Legendre
// polynomials of t = 2x - 1 (same curves as the plain powers, but a well-conditioned system);
// the intercept is not penalised, so a huge lambda gives a flat line at the mean.
// Fit: minimise  sum (y - fit)^2 + lambda * sum_{k>=1} b_k^2, i.e. solve
//   (X'X + lambda * D) b = X'y,  D = diag(0, 1, ..., 1),  by Cholesky (symmetric positive definite).
import { rng } from "../lib/ui";

export const DEG = 10;
export const NOISE = 0.6;          // SD of the measurement noise
export const LOG_MIN = -6, LOG_MAX = 3;

/** True mean expression at dose x in [0, 1]: rises, peaks, then falls a little (toxicity). */
export function truth(x: number): number {
  return 1 + 4.5 / (1 + Math.exp(-12 * (x - 0.35))) - 2.2 * x * x;
}

/** Legendre polynomials P0..P_DEG at t = 2x - 1. */
export function basis(x: number): number[] {
  const t = 2 * x - 1;
  const p = [1, t];
  for (let k = 1; k < DEG; k++) p.push(((2 * k + 1) * t * p[k] - k * p[k - 1]) / (k + 1));
  return p;
}

export interface Sample { x: number[]; y: number[] }

/** n points at stratified doses ((i + u) / n) with noise; deterministic in seed. */
export function sample(n: number, seed: number): Sample {
  const r = rng(seed);
  const x: number[] = [], y: number[] = [];
  for (let i = 0; i < n; i++) {
    const xi = (i + r.unif()) / n;
    x.push(xi);
    y.push(truth(xi) + NOISE * r.norm());
  }
  return { x, y };
}

/** Normal equations X'X and X'y, computed once per data set. */
export interface Normal { A: number[][]; b: number[] }
export function normal(s: Sample): Normal {
  const m = DEG + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  s.x.forEach((xi, i) => {
    const f = basis(xi);
    for (let j = 0; j < m; j++) {
      b[j] += f[j] * s.y[i];
      for (let k = 0; k < m; k++) A[j][k] += f[j] * f[k];
    }
  });
  return { A, b };
}

/** Solve M c = v for symmetric positive definite M (Cholesky). */
export function cholSolve(M: number[][], v: number[]): number[] {
  const m = v.length;
  const L = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= i; j++) {
      let s = M[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j][j];
    }
  }
  const z = new Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    let s = v[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * z[k];
    z[i] = s / L[i][i];
  }
  const c = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < m; k++) s -= L[k][i] * c[k];
    c[i] = s / L[i][i];
  }
  return c;
}

/** Ridge coefficients for one lambda. */
export function fit(ne: Normal, lambda: number): number[] {
  const M = ne.A.map((row, j) => row.map((v, k) => (j === k && j > 0 ? v + lambda : v)));
  return cholSolve(M, ne.b);
}

export function predict(c: number[], x: number): number {
  const f = basis(x);
  let s = 0;
  for (let k = 0; k < c.length; k++) s += c[k] * f[k];
  return s;
}

/** Typical error: root mean squared difference between data and fit. */
export function rmse(c: number[], s: Sample): number {
  let ss = 0;
  s.x.forEach((xi, i) => { const d = s.y[i] - predict(c, xi); ss += d * d; });
  return Math.sqrt(ss / s.x.length);
}

/** Slider position (0..POS) <-> lambda, log scale, 10 steps per factor 10. */
export const POS = (LOG_MAX - LOG_MIN) * 10;
export const posToLambda = (p: number): number => 10 ** (LOG_MIN + p / 10);
export const lambdaToPos = (l: number): number =>
  Math.max(0, Math.min(POS, Math.round((Math.log10(l) - LOG_MIN) * 10)));

export interface Curves { train: number[]; test: number[]; best: number }

/** Training and test error at every slider position; best = position of the lowest test error. */
export function curves(train: Sample, test: Sample): Curves {
  const ne = normal(train);
  const tr: number[] = [], te: number[] = [];
  let best = 0;
  for (let p = 0; p <= POS; p++) {
    const c = fit(ne, posToLambda(p));
    tr.push(rmse(c, train));
    te.push(rmse(c, test));
    if (te[p] < te[best]) best = p;
  }
  return { train: tr, test: te, best };
}
