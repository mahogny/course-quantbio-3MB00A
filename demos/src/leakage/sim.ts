// Pure simulation for the leakage demo (no DOM), so it can be tested with node.
// Pure noise: n samples x p features ~ N(0,1), balanced random labels (no signal at all).
// Classifier: nearest centroid on the k features with the largest |t| (two-sample t).
import { rng } from "../lib/ui";

export interface Dataset { n: number; p: number; X: Float64Array; y: Uint8Array; fold: Uint8Array }
export interface CvResult { acc: number; correct: boolean[]; features: number[] }

export const NFOLDS = 5;

/** Pure-noise data with balanced labels and balanced fold assignment, from one seed. */
export function makeData(n: number, p: number, seed: number): Dataset {
  const r = rng(seed * 7919 + 13);
  const X = new Float64Array(n * p);
  for (let i = 0; i < X.length; i++) X[i] = r.norm();
  const y = new Uint8Array(n);
  for (let i = 0; i < n; i++) y[i] = i < n / 2 ? 1 : 0;
  shuffle(y, r.unif);
  // stratified folds: deal each class round-robin over the folds, in random order
  const fold = new Uint8Array(n);
  for (const cls of [0, 1]) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (y[i] === cls) idx.push(i);
    shuffle(idx, r.unif);
    const off = cls === 0 ? 0 : Math.floor(idx.length % NFOLDS);
    idx.forEach((i, j) => (fold[i] = (j + off) % NFOLDS));
  }
  return { n, p, X, y, fold };
}

function shuffle<T>(a: { length: number;[i: number]: T }, unif: () => number): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(unif() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
}

/** Indices of the k features with the largest |t| (pooled two-sample t), using only rows in `use`. */
export function topK(d: Dataset, use: boolean[], k: number): number[] {
  const { n, p, X, y } = d;
  const s1 = new Float64Array(p), s0 = new Float64Array(p), q1 = new Float64Array(p), q0 = new Float64Array(p);
  let n1 = 0, n0 = 0;
  for (let i = 0; i < n; i++) {
    if (!use[i]) continue;
    const row = i * p;
    if (y[i]) { n1++; for (let j = 0; j < p; j++) { const v = X[row + j]; s1[j] += v; q1[j] += v * v; } }
    else { n0++; for (let j = 0; j < p; j++) { const v = X[row + j]; s0[j] += v; q0[j] += v * v; } }
  }
  const t = new Float64Array(p);
  for (let j = 0; j < p; j++) {
    const m1 = s1[j] / n1, m0 = s0[j] / n0;
    const ss = (q1[j] - n1 * m1 * m1) + (q0[j] - n0 * m0 * m0);
    const sp2 = ss / (n1 + n0 - 2);
    t[j] = Math.abs(m1 - m0) / Math.sqrt(sp2 * (1 / n1 + 1 / n0));
  }
  const order = Array.from({ length: p }, (_, j) => j).sort((a, b) => t[b] - t[a]);
  return order.slice(0, k);
}

/** Nearest-centroid prediction for the rows in `test`, trained on `train`, using `feats`. */
function nearestCentroid(d: Dataset, train: boolean[], feats: number[], test: number[]): number[] {
  const { n, p, X, y } = d;
  const k = feats.length;
  const c1 = new Float64Array(k), c0 = new Float64Array(k);
  let n1 = 0, n0 = 0;
  for (let i = 0; i < n; i++) {
    if (!train[i]) continue;
    const c = y[i] ? c1 : c0;
    if (y[i]) n1++; else n0++;
    for (let f = 0; f < k; f++) c[f] += X[i * p + feats[f]];
  }
  for (let f = 0; f < k; f++) { c1[f] /= n1; c0[f] /= n0; }
  return test.map(i => {
    let d1 = 0, d0 = 0;
    for (let f = 0; f < k; f++) {
      const v = X[i * p + feats[f]];
      d1 += (v - c1[f]) ** 2; d0 += (v - c0[f]) ** 2;
    }
    return d1 < d0 ? 1 : 0;
  });
}

/**
 * 5-fold CV accuracy. leaky = true: the top-k features are chosen once on ALL samples,
 * before the split. leaky = false: they are re-chosen inside each fold, on its training rows only.
 */
export function cvAccuracy(d: Dataset, k: number, leaky: boolean): CvResult {
  const { n } = d;
  const all = new Array<boolean>(n).fill(true);
  const leakFeats = leaky ? topK(d, all, k) : [];
  const correct = new Array<boolean>(n).fill(false);
  let features = leakFeats;
  for (let f = 0; f < NFOLDS; f++) {
    const train = Array.from(d.fold, v => v !== f);
    const test: number[] = [];
    for (let i = 0; i < n; i++) if (d.fold[i] === f) test.push(i);
    const feats = leaky ? leakFeats : topK(d, train, k);
    if (f === 0 && !leaky) features = feats;
    const pred = nearestCentroid(d, train, feats, test);
    test.forEach((i, j) => (correct[i] = pred[j] === d.y[i]));
  }
  const acc = correct.filter(Boolean).length / n;
  return { acc, correct, features };
}
