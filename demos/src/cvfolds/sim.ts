// Data, folds and ridge fits for the cvfolds demo (no DOM, testable with node).
// Data: n samples x P genes; only the first few genes matter:
//   y = 2 g1 + 1.5 g2 - 1.2 g3 + g4 + noise (SD 1.5).
// "Pairs": the n patients are each measured twice (2n samples). Both samples of a patient share the
// patient's genes AND the patient's noise in y; each measurement adds only a little technical
// noise (SD 0.25 on the genes, 0.2 on y). A model that has memorised one twin predicts the
// other too well, so ordinary CV (twins may be split across folds) is optimistic; grouped CV
// keeps both samples of a patient in the same fold.
// Model: ridge, RSS + lambda * sum(beta^2), on genes standardised with the training rows only
// (mean 0, SD 1) and centred y, i.e. what glmnet does inside each fold (alpha = 0).
// Fold error: mean squared error (MSE) on the held-out samples. CV error at each lambda: the mean
// of the k fold MSEs; SE = SD of the fold MSEs / sqrt(k) (as cv.glmnet with equal folds).
import { rng } from "../lib/ui";

export const P = 34;                       // genes: 4 real + 30 noise
export const BETA = [2.0, 1.5, -1.2, 1.0]; // effects of the real genes
export const NOISE = 1.5, TECH_X = 0.25, TECH_Y = 0.2;
export const LAMBDAS: number[] = Array.from({ length: 33 }, (_, i) => 10 ** (-1 + i * 0.15)); // 0.1 .. ~6300

export interface Data {
  n: number; p: number;
  X: Float64Array;      // row-major n x p
  y: Float64Array;
  unit: Int32Array;     // patient id of each sample (twins share it); unit[i] = i without pairs
  nUnits: number;
}

/**
 * nPatients patients; with pairs each is measured twice (twins are samples 2u and 2u + 1).
 * The patients themselves (genes, noise in y) do not depend on `pairs`; the technical noise of
 * each measurement comes from a second random stream.
 */
export function makeData(nPatients: number, pairs: boolean, seed: number): Data {
  const r = rng(seed * 7919 + 13), rt = rng(seed * 7919 + 5281);
  const p = P;
  const nUnits = nPatients;
  const per = pairs ? 2 : 1;
  const n = nUnits * per;
  const X = new Float64Array(n * p), y = new Float64Array(n), unit = new Int32Array(n);
  for (let u = 0; u < nUnits; u++) {
    const g = Array.from({ length: p }, () => r.norm());
    let mu = 0;
    for (let j = 0; j < BETA.length; j++) mu += BETA[j] * g[j];
    const e = NOISE * r.norm();
    for (let t = 0; t < per; t++) {
      const i = u * per + t;
      unit[i] = u;
      for (let j = 0; j < p; j++) X[i * p + j] = g[j] + (pairs ? TECH_X * rt.norm() : 0);
      y[i] = mu + e + (pairs ? TECH_Y * rt.norm() : 0);
    }
  }
  return { n, p, X, y, unit, nUnits };
}

/**
 * Fold of each sample, as R's sample(rep(1:k, length.out = m)) over the m units:
 * samples when grouped = false, patients when grouped = true. k >= number of units = leave one out.
 */
export function makeFolds(d: Data, k: number, grouped: boolean, seed: number): { fold: Int32Array; k: number } {
  const r = rng(seed * 104729 + 7);
  const m = grouped ? d.nUnits : d.n;
  const kk = Math.min(k, m);
  const lab = Array.from({ length: m }, (_, i) => i % kk);
  for (let i = m - 1; i > 0; i--) { const j = Math.floor(r.unif() * (i + 1)); [lab[i], lab[j]] = [lab[j], lab[i]]; }
  const fold = new Int32Array(d.n);
  for (let i = 0; i < d.n; i++) fold[i] = lab[grouped ? d.unit[i] : i];
  return { fold, k: kk };
}

/** Solve A x = b for symmetric positive definite A (p x p, row-major) by Cholesky. */
export function cholSolve(A: Float64Array, b: Float64Array, p: number): Float64Array {
  const L = new Float64Array(p * p);
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * p + j];
      for (let q = 0; q < j; q++) s -= L[i * p + q] * L[j * p + q];
      L[i * p + j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j * p + j];
    }
  }
  const z = new Float64Array(p);
  for (let i = 0; i < p; i++) { let s = b[i]; for (let q = 0; q < i; q++) s -= L[i * p + q] * z[q]; z[i] = s / L[i * p + i]; }
  const x = new Float64Array(p);
  for (let i = p - 1; i >= 0; i--) { let s = z[i]; for (let q = i + 1; q < p; q++) s -= L[q * p + i] * x[q]; x[i] = s / L[i * p + i]; }
  return x;
}

/**
 * Ridge fit on the rows with train[i] = true, for every lambda; returns the MSE on the test rows
 * (and, if test is empty, nothing) plus the MSE on the training rows.
 */
export function ridgeErrors(d: Data, train: boolean[], lambdas: number[]): { test: number[]; train: number[] } {
  const { n, p, X, y } = d;
  const tr: number[] = [], te: number[] = [];
  for (let i = 0; i < n; i++) (train[i] ? tr : te).push(i);
  const mu = new Float64Array(p), sd = new Float64Array(p);
  let ym = 0;
  for (const i of tr) { ym += y[i]; for (let j = 0; j < p; j++) mu[j] += X[i * p + j]; }
  ym /= tr.length;
  for (let j = 0; j < p; j++) mu[j] /= tr.length;
  for (const i of tr) for (let j = 0; j < p; j++) sd[j] += (X[i * p + j] - mu[j]) ** 2;
  for (let j = 0; j < p; j++) sd[j] = Math.sqrt(sd[j] / tr.length) || 1;
  const Zm = new Float64Array(n * p);   // standardised genes, all rows (training mean and SD)
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) Zm[i * p + j] = (X[i * p + j] - mu[j]) / sd[j];
  const Z = (i: number, j: number) => Zm[i * p + j];
  const G = new Float64Array(p * p), c = new Float64Array(p);
  for (const i of tr) {
    const yi = y[i] - ym, o = i * p;
    for (let a = 0; a < p; a++) {
      const za = Zm[o + a];
      c[a] += za * yi;
      for (let b = 0; b <= a; b++) G[a * p + b] += za * Zm[o + b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) G[b * p + a] = G[a * p + b];
  const mse = (rows: number[], beta: Float64Array) => {
    if (!rows.length) return NaN;
    let s = 0;
    for (const i of rows) {
      let f = ym;
      for (let j = 0; j < p; j++) f += Z(i, j) * beta[j];
      s += (y[i] - f) ** 2;
    }
    return s / rows.length;
  };
  const test: number[] = [], trainE: number[] = [];
  for (const lam of lambdas) {
    const A = G.slice();
    for (let a = 0; a < p; a++) A[a * p + a] += lam;
    const beta = cholSolve(A, c, p);
    test.push(mse(te, beta));
    trainE.push(mse(tr, beta));
  }
  return { test, train: trainE };
}

export interface CvResult {
  k: number;
  fold: Int32Array;
  foldErr: number[][];   // [fold][lambda] held-out MSE
  mean: number[];        // CV error per lambda (all folds)
  se: number[];
  iMin: number;          // index of lambda.min
  i1se: number;          // index of lambda.1se
}

/** Mean and SE over the first `m` folds, and the lambda.min / lambda.1se indices (lambdas increasing). */
export function summarise(foldErr: number[][], m: number): { mean: number[]; se: number[]; iMin: number; i1se: number } {
  const L = foldErr[0].length;
  const mean: number[] = [], se: number[] = [];
  for (let l = 0; l < L; l++) {
    let s = 0;
    for (let f = 0; f < m; f++) s += foldErr[f][l];
    const mu = s / m;
    let v = 0;
    for (let f = 0; f < m; f++) v += (foldErr[f][l] - mu) ** 2;
    mean.push(mu);
    se.push(m > 1 ? Math.sqrt(v / (m - 1) / m) : 0);
  }
  let iMin = 0;
  for (let l = 1; l < L; l++) if (mean[l] < mean[iMin]) iMin = l;
  const thr = mean[iMin] + se[iMin];
  let i1se = iMin;
  for (let l = L - 1; l >= iMin; l--) if (mean[l] <= thr) { i1se = l; break; }
  return { mean, se, iMin, i1se };
}

export function crossValidate(d: Data, k: number, grouped: boolean, foldSeed: number, lambdas = LAMBDAS): CvResult {
  const { fold, k: kk } = makeFolds(d, k, grouped, foldSeed);
  const foldErr: number[][] = [];
  for (let f = 0; f < kk; f++) {
    const train = Array.from(fold, v => v !== f);
    foldErr.push(ridgeErrors(d, train, lambdas).test);
  }
  return { k: kk, fold, foldErr, ...summarise(foldErr, kk) };
}

/** Training error of the fit on all samples, per lambda. */
export function trainingError(d: Data, lambdas = LAMBDAS): number[] {
  return ridgeErrors(d, new Array<boolean>(d.n).fill(true), lambdas).train;
}

/** Error on many new patients (each measured once), per lambda: the "truth" CV is estimating. */
export function newPatientError(d: Data, nNew: number, seed: number, lambdas = LAMBDAS): number[] {
  const fresh = makeData(nNew, false, seed + 99991);
  const all: Data = {
    n: d.n + nNew, p: d.p, nUnits: d.nUnits + nNew,
    X: new Float64Array([...d.X, ...fresh.X]), y: new Float64Array([...d.y, ...fresh.y]),
    unit: new Int32Array(d.n + nNew),
  };
  const train = Array.from({ length: all.n }, (_, i) => i < d.n);
  return ridgeErrors(all, train, lambdas).test;
}
