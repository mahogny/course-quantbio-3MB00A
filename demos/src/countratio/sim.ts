// Simulated read counts for the countratio demo (no DOM, testable with node).
// A count is the number of reads drawn at random for a gene whose expected count is n
// (Poisson(n); the demo does not name the distribution). Optional "biological
// variation": each sample's expected count is first multiplied by a Gamma(SHAPE)/SHAPE
// factor (mean 1, CV 1/sqrt(SHAPE) = 0.22), i.e. a gamma–Poisson mixture.
import { rng } from "../lib/ui";
import { rgamma, rpois } from "../nbdisp/stats";

export const SHAPE = 20;

type U = () => number;

/** One count with expected value n. */
export function drawCount(n: number, bio: boolean, unif: U): number {
  const lambda = bio ? n * rgamma(SHAPE, unif) / SHAPE : n;
  return rpois(lambda, unif);
}

/** N replicate pairs (x, y), both with the same expected count n. */
export function pairs(n: number, bio: boolean, N: number, seed: number): { x: number[]; y: number[] } {
  const u = rng(seed).unif;
  const x: number[] = [], y: number[] = [];
  for (let i = 0; i < N; i++) { x.push(drawCount(n, bio, u)); y.push(drawCount(n, bio, u)); }
  return { x, y };
}

export interface Genes { mean: number[]; x: number[]; y: number[] }

/** G genes with expected counts log-uniform on [lo, hi], the same in both samples. */
export function genes(G: number, bio: boolean, seed: number, lo = 0.5, hi = 5000): Genes {
  const r = rng(seed + 1000);
  const mean: number[] = [], x: number[] = [], y: number[] = [];
  for (let g = 0; g < G; g++) {
    const m = Math.exp(Math.log(lo) + r.unif() * Math.log(hi / lo));
    mean.push(m); x.push(drawCount(m, bio, r.unif)); y.push(drawCount(m, bio, r.unif));
  }
  return { mean, x, y };
}

/** log2(x / y): -Infinity when x = 0, +Infinity when y = 0, NaN when both are 0. */
export function log2ratio(x: number, y: number): number {
  if (x === 0 && y === 0) return NaN;
  return Math.log2(x / y);
}

export interface Summary {
  N: number;
  zeroX: number;      // x = 0, y > 0: ratio 0
  zeroY: number;      // y = 0, x > 0: ratio infinite
  both: number;       // 0 / 0: no ratio
  finite: number[];   // log2 ratios of pairs with no zero
  sd: number;         // SD of the finite log2 ratios
  twofold: number;    // fraction of pairs with a ratio (not 0/0) that is >= 2-fold either way
  sdCount: number;    // SD of all x and y around n
}

export function summarize(x: number[], y: number[], n: number): Summary {
  let zeroX = 0, zeroY = 0, both = 0, big = 0, ss = 0;
  const finite: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const l = log2ratio(x[i], y[i]);
    ss += (x[i] - n) ** 2 + (y[i] - n) ** 2;
    if (Number.isNaN(l)) { both++; continue; }
    if (l === -Infinity) zeroX++;
    else if (l === Infinity) zeroY++;
    else finite.push(l);
    if (Math.abs(l) >= 1) big++;
  }
  const m = finite.reduce((a, b) => a + b, 0) / Math.max(1, finite.length);
  const sd = finite.length > 1 ? Math.sqrt(finite.reduce((a, b) => a + (b - m) ** 2, 0) / (finite.length - 1)) : NaN;
  const withRatio = x.length - both;
  return { N: x.length, zeroX, zeroY, both, finite, sd, twofold: withRatio ? big / withRatio : NaN,
    sdCount: Math.sqrt(ss / (2 * x.length)) };
}

/** Indices of the k genes with the largest |log2 ratio| among genes with both counts > 0. */
export function topFinite(x: number[], y: number[], k: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < x.length; i++) if (x[i] > 0 && y[i] > 0) idx.push(i);
  const a = (i: number) => Math.abs(Math.log2(x[i] / y[i]));
  return idx.sort((i, j) => a(j) - a(i)).slice(0, k);
}
