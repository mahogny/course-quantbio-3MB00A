// A small, faithful UMAP (no DOM), so it can be unit-tested with node.
// Follows the steps of umap-learn (McInnes, Healy & Melville 2018) at toy scale:
//  1. exact kNN in the high-dimensional space;
//  2. per cell, rho_i (distance to the nearest neighbour) and sigma_i (binary search so that
//     sum_j exp(-(d_ij - rho_i)/sigma_i) = log2 k);
//  3. fuzzy union w_ij = a + b - a*b of the two directed weights;
//  4. low-dimensional similarity 1/(1 + a d^(2b)), with a, b fitted from min_dist;
//  5. SGD: attraction along edges sampled by weight, repulsion from random negative samples,
//     clipped gradients, learning rate decaying linearly to 0 over the epochs.
// There is no mapping function: the 2D position of every cell is a free parameter.
import { rng } from "../lib/ui";

export type Rand = ReturnType<typeof rng>;

/** Exact k nearest neighbours (self excluded), sorted by distance. Flattened n×k arrays. */
export interface Knn { n: number; k: number; idx: Int32Array; dist: Float64Array }

export function sqDist(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let p = 0; p < a.length; p++) { const d = a[p] - b[p]; s += d * d; }
  return s;
}

export function knn(X: number[][], k: number): Knn {
  const n = X.length;
  k = Math.min(k, n - 1);
  const idx = new Int32Array(n * k), dist = new Float64Array(n * k);
  const d = new Float64Array(n), order = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) { d[j] = j === i ? Infinity : sqDist(X[i], X[j]); order[j] = j; }
    order.sort((a, b) => d[a] - d[b] || a - b);
    for (let m = 0; m < k; m++) { idx[i * k + m] = order[m]; dist[i * k + m] = Math.sqrt(d[order[m]]); }
  }
  return { n, k, idx, dist };
}

/** rho_i and sigma_i for every cell (umap-learn's smooth_knn_dist, with the nearest neighbour at weight 1). */
export function smoothKnn(g: Knn, nIter = 64, tol = 1e-5): { rho: Float64Array; sigma: Float64Array } {
  const { n, k, dist } = g;
  const target = Math.log2(k);
  const rho = new Float64Array(n), sigma = new Float64Array(n);
  let meanAll = 0;
  for (let q = 0; q < n * k; q++) meanAll += dist[q];
  meanAll /= n * k;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let m = 0; m < k; m++) { const v = dist[i * k + m]; if (v > 0) { r = v; break; } }
    rho[i] = r;
    let lo = 0, hi = Infinity, mid = 1;
    for (let it = 0; it < nIter; it++) {
      let s = 0;
      for (let m = 0; m < k; m++) {
        const dd = dist[i * k + m] - r;
        s += dd > 0 ? Math.exp(-dd / mid) : 1;
      }
      if (Math.abs(s - target) < tol) break;
      if (s > target) { hi = mid; mid = (lo + hi) / 2; }
      else { lo = mid; mid = hi === Infinity ? mid * 2 : (lo + hi) / 2; }
    }
    // umap-learn's floor, so sigma never collapses to zero
    let mi = 0;
    for (let m = 0; m < k; m++) mi += dist[i * k + m];
    mi /= k;
    const floor = 1e-3 * (r > 0 ? mi : meanAll);
    sigma[i] = Math.max(mid, floor);
  }
  return { rho, sigma };
}

/** The symmetric fuzzy graph as an undirected edge list (i < j). */
export interface Graph { n: number; i: Int32Array; j: Int32Array; w: Float64Array }

export function fuzzyGraph(g: Knn): Graph {
  const { n, k, idx, dist } = g;
  const { rho, sigma } = smoothKnn(g);
  const A: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  for (let i = 0; i < n; i++) {
    for (let m = 0; m < k; m++) {
      const j = idx[i * k + m], dd = dist[i * k + m] - rho[i];
      A[i].set(j, dd > 0 ? Math.exp(-dd / sigma[i]) : 1);
    }
  }
  const I: number[] = [], J: number[] = [], W: number[] = [];
  for (let i = 0; i < n; i++) {
    for (const [j, a] of A[i]) {
      const b = A[j].get(i) ?? 0;
      if (b > 0 && j < i) continue;            // already added from the j side
      const w = a + b - a * b;                 // fuzzy union
      I.push(Math.min(i, j)); J.push(Math.max(i, j)); W.push(w);
    }
  }
  return { n, i: Int32Array.from(I), j: Int32Array.from(J), w: Float64Array.from(W) };
}

/**
 * Fit a, b of 1/(1 + a x^(2b)) to the target curve (1 for x < min_dist, exp(-(x - min_dist)/spread)
 * after it), on 300 points of [0, 3 spread], by Levenberg-Marquardt least squares, as umap-learn does
 * with scipy's curve_fit.
 */
export function findAB(minDist: number, spread = 1): { a: number; b: number } {
  const N = 300, xs: number[] = [], ys: number[] = [];
  for (let q = 0; q < N; q++) {
    const x = (3 * spread * q) / (N - 1);
    xs.push(x);
    ys.push(x < minDist ? 1 : Math.exp(-(x - minDist) / spread));
  }
  const sse = (a: number, b: number) => {
    let s = 0;
    for (let q = 0; q < N; q++) { const r = 1 / (1 + a * Math.pow(xs[q], 2 * b)) - ys[q]; s += r * r; }
    return s;
  };
  let a = 1, b = 1, lam = 1e-3, cur = sse(a, b);
  for (let it = 0; it < 500; it++) {
    let h11 = 0, h12 = 0, h22 = 0, g1 = 0, g2 = 0;
    for (let q = 0; q < N; q++) {
      const x = xs[q];
      if (x <= 0) continue;
      const u = Math.pow(x, 2 * b), f = 1 / (1 + a * u), r = f - ys[q];
      const da = -u * f * f, db = -a * u * 2 * Math.log(x) * f * f;
      h11 += da * da; h12 += da * db; h22 += db * db; g1 += da * r; g2 += db * r;
    }
    const m11 = h11 * (1 + lam), m22 = h22 * (1 + lam), det = m11 * m22 - h12 * h12;
    const sa = -(m22 * g1 - h12 * g2) / det, sb = -(m11 * g2 - h12 * g1) / det;
    const na = a + sa, nb = b + sb;
    const nw = na > 0 && nb > 0 ? sse(na, nb) : Infinity;
    if (nw < cur) {
      const done = Math.abs(cur - nw) < 1e-14 * Math.max(1, cur);
      a = na; b = nb; cur = nw; lam *= 0.3;
      if (done) break;
    } else lam *= 10;
    if (lam > 1e12) break;
  }
  return { a, b };
}

/** Rescale each coordinate to [0, 10], as umap-learn does after initialisation. */
function rescale10(y: Float64Array): void {
  const n = y.length / 2;
  for (let d = 0; d < 2; d++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, y[2 * i + d]); hi = Math.max(hi, y[2 * i + d]); }
    const s = hi > lo ? 10 / (hi - lo) : 1;
    for (let i = 0; i < n; i++) y[2 * i + d] = (y[2 * i + d] - lo) * s;
  }
}

export function randomInit(n: number, r: Rand): Float64Array {
  const y = new Float64Array(2 * n);
  for (let q = 0; q < 2 * n; q++) y[q] = -10 + 20 * r.unif();
  rescale10(y);
  return y;
}

/**
 * Spectral initialisation: the 2nd and 3rd eigenvectors of the normalised graph Laplacian
 * L = I - D^(-1/2) W D^(-1/2), found by power (subspace) iteration on (I + D^(-1/2) W D^(-1/2))/2
 * after removing the trivial eigenvector sqrt(degree).
 */
export function spectralInit(G: Graph, r: Rand, nIter = 300): Float64Array {
  const n = G.n, E = G.w.length;
  const deg = new Float64Array(n);
  for (let e = 0; e < E; e++) { deg[G.i[e]] += G.w[e]; deg[G.j[e]] += G.w[e]; }
  const isq = deg.map(d => (d > 0 ? 1 / Math.sqrt(d) : 0));
  let t0 = new Float64Array(n), nt = 0;
  for (let i = 0; i < n; i++) { t0[i] = Math.sqrt(deg[i]); nt += deg[i]; }
  t0 = t0.map(v => v / Math.sqrt(nt));
  const mult = (v: Float64Array): Float64Array => {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = 0.5 * v[i];
    for (let e = 0; e < E; e++) {
      const a = G.i[e], b = G.j[e], m = 0.5 * G.w[e] * isq[a] * isq[b];
      out[a] += m * v[b]; out[b] += m * v[a];
    }
    return out;
  };
  const orth = (v: Float64Array, basis: Float64Array[]) => {
    for (const u of basis) {
      let dot = 0;
      for (let i = 0; i < n; i++) dot += u[i] * v[i];
      for (let i = 0; i < n; i++) v[i] -= dot * u[i];
    }
    let nn = 0;
    for (let i = 0; i < n; i++) nn += v[i] * v[i];
    nn = Math.sqrt(nn) || 1;
    for (let i = 0; i < n; i++) v[i] /= nn;
  };
  let v1: Float64Array = new Float64Array(n).map(() => r.norm()), v2: Float64Array = new Float64Array(n).map(() => r.norm());
  orth(v1, [t0]); orth(v2, [t0, v1]);
  for (let it = 0; it < nIter; it++) {
    v1 = mult(v1); v2 = mult(v2);
    orth(v1, [t0]); orth(v2, [t0, v1]);
  }
  const y = new Float64Array(2 * n);
  let mx = 0;
  for (let i = 0; i < n; i++) { y[2 * i] = v1[i]; y[2 * i + 1] = v2[i]; mx = Math.max(mx, Math.abs(v1[i]), Math.abs(v2[i])); }
  for (let q = 0; q < 2 * n; q++) y[q] = (y[q] * 10) / (mx || 1) + 1e-4 * r.norm();
  rescale10(y);
  return y;
}

const clip = (v: number) => (v > 4 ? 4 : v < -4 ? -4 : v);

export interface UmapOpts { k: number; minDist: number; nEpochs: number; init: "random" | "spectral"; seed: number; negRate?: number }

/** The optimiser. Construct, then call epoch() nEpochs times (or step(m)). */
export class Umap {
  n: number; knn: Knn; graph: Graph; a = 1; b = 1;
  y: Float64Array = new Float64Array(0); epochCount = 0;
  private head = new Int32Array(0); private tail = new Int32Array(0);
  private eps: Float64Array = new Float64Array(0); private next: Float64Array = new Float64Array(0);
  private epsNeg: Float64Array = new Float64Array(0); private nextNeg: Float64Array = new Float64Array(0);
  private r: Rand;

  constructor(public X: number[][], public opts: UmapOpts) {
    this.n = X.length;
    this.knn = knn(X, opts.k);
    this.graph = fuzzyGraph(this.knn);
    this.r = rng(opts.seed);
    ({ a: this.a, b: this.b } = findAB(opts.minDist));
    this.restart();
  }

  get done(): boolean { return this.epochCount >= this.opts.nEpochs; }

  setK(k: number): void { this.opts.k = k; this.knn = knn(this.X, k); this.graph = fuzzyGraph(this.knn); this.restart(); }
  setMinDist(m: number): void { this.opts.minDist = m; ({ a: this.a, b: this.b } = findAB(m)); this.restart(); }

  /** Back to epoch 0 with the current seed and init. */
  restart(): void {
    const { n, graph: G, opts } = this;
    this.r = rng(opts.seed);
    this.y = opts.init === "spectral" ? spectralInit(G, this.r) : randomInit(n, this.r);
    // both directions of each undirected edge, as in umap-learn's COO graph
    const E = G.w.length;
    let wmax = 0;
    for (let e = 0; e < E; e++) wmax = Math.max(wmax, G.w[e]);
    const H: number[] = [], T: number[] = [], P: number[] = [];
    for (let e = 0; e < E; e++) {
      if (G.w[e] < wmax / opts.nEpochs) continue;   // too weak to be sampled even once
      const p = wmax / G.w[e];
      H.push(G.i[e], G.j[e]); T.push(G.j[e], G.i[e]); P.push(p, p);
    }
    this.head = Int32Array.from(H); this.tail = Int32Array.from(T);
    this.eps = Float64Array.from(P); this.next = Float64Array.from(P);
    const neg = opts.negRate ?? 5;
    this.epsNeg = this.eps.map(v => v / neg); this.nextNeg = this.epsNeg.slice();
    this.epochCount = 0;
  }

  /** One epoch of SGD. */
  epoch(): void {
    if (this.done) return;
    const { y, a, b, head, tail, eps, next, epsNeg, nextNeg, n } = this;
    const nE = this.opts.nEpochs, ep = this.epochCount + 1;     // umap-learn samples edges with next <= ep
    const alpha = 1 - this.epochCount / nE;
    const unif = this.r.unif;
    for (let e = 0; e < head.length; e++) {
      if (next[e] > ep) continue;
      const j = head[e], k = tail[e];
      let dx = y[2 * j] - y[2 * k], dy = y[2 * j + 1] - y[2 * k + 1];
      let d2 = dx * dx + dy * dy;
      if (d2 > 0) {
        const pb = Math.pow(d2, b);
        const gc = (-2 * a * b * pb / d2) / (a * pb + 1);
        const gx = clip(gc * dx) * alpha, gy = clip(gc * dy) * alpha;
        y[2 * j] += gx; y[2 * j + 1] += gy;
        y[2 * k] -= gx; y[2 * k + 1] -= gy;
      }
      next[e] += eps[e];
      const nNeg = Math.floor((ep - nextNeg[e]) / epsNeg[e]);
      for (let p = 0; p < nNeg; p++) {
        const q = Math.floor(unif() * n);
        if (q === j) continue;
        dx = y[2 * j] - y[2 * q]; dy = y[2 * j + 1] - y[2 * q + 1];
        d2 = dx * dx + dy * dy;
        if (d2 > 0) {
          const gc = (2 * b) / ((0.001 + d2) * (a * Math.pow(d2, b) + 1));
          y[2 * j] += clip(gc * dx) * alpha; y[2 * j + 1] += clip(gc * dy) * alpha;
        } else {
          y[2 * j] += 4 * alpha; y[2 * j + 1] += 4 * alpha;
        }
      }
      nextNeg[e] += Math.max(0, nNeg) * epsNeg[e];
    }
    this.epochCount++;
  }

  step(m: number): void { for (let q = 0; q < m && !this.done; q++) this.epoch(); }
}

// ---------------------------------------------------------------------------
// PCA of the high-dimensional data (the linear map shown next to UMAP)
// ---------------------------------------------------------------------------
export interface PcaNd { mean: number[]; pcs: number[][]; scores: [number, number][]; varFrac: [number, number] }

/** Top two principal components by power iteration on the covariance matrix. */
export function pcaNd(X: number[][], seed = 1): PcaNd {
  const n = X.length, D = X[0].length;
  const mean = new Array(D).fill(0);
  for (const x of X) for (let p = 0; p < D; p++) mean[p] += x[p] / n;
  const C = Array.from({ length: D }, () => new Array(D).fill(0));
  let total = 0;
  for (const x of X) {
    for (let p = 0; p < D; p++) {
      const u = x[p] - mean[p];
      for (let q = p; q < D; q++) C[p][q] += (u * (x[q] - mean[q])) / (n - 1);
    }
  }
  for (let p = 0; p < D; p++) { total += C[p][p]; for (let q = 0; q < p; q++) C[p][q] = C[q][p]; }
  const r = rng(seed);
  const pcs: number[][] = [], lams: number[] = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: D }, () => r.norm());
    let lam = 0;
    for (let it = 0; it < 1000; it++) {
      for (const u of pcs) { const d = u.reduce((s, ui, p) => s + ui * v[p], 0); v = v.map((vi, p) => vi - d * u[p]); }
      const w = C.map(row => row.reduce((s, cpq, q) => s + cpq * v[q], 0));
      for (const u of pcs) { const d = u.reduce((s, ui, p) => s + ui * w[p], 0); for (let p = 0; p < D; p++) w[p] -= d * u[p]; }
      const nn = Math.hypot(...w) || 1;
      const nv = w.map(x => x / nn);
      const diff = nv.reduce((s, x, p) => s + Math.abs(x - v[p]), 0);
      v = nv; lam = nn;
      if (diff < 1e-12) break;
    }
    // fix the sign: largest loading positive
    let big = 0;
    for (let p = 0; p < D; p++) if (Math.abs(v[p]) > Math.abs(v[big])) big = p;
    if (v[big] < 0) v = v.map(x => -x);
    pcs.push(v); lams.push(lam);
  }
  const scores = X.map(x => pcs.map(u => u.reduce((s, ui, p) => s + ui * (x[p] - mean[p]), 0)) as [number, number]);
  return { mean, pcs, scores, varFrac: [lams[0] / total, lams[1] / total] };
}

// ---------------------------------------------------------------------------
// Diagnostics (used in the node tests and for the exercise answers)
// ---------------------------------------------------------------------------
function knn2d(y: Float64Array, m: number): Int32Array {
  const n = y.length / 2;
  const P: number[][] = [];
  for (let i = 0; i < n; i++) P.push([y[2 * i], y[2 * i + 1]]);
  return knn(P, m).idx;
}

/** Mean fraction of each point's m nearest 2D neighbours that share its group. */
export function groupPurity(y: Float64Array, group: ArrayLike<number>, m = 10): number {
  const n = y.length / 2, idx = knn2d(y, m);
  let s = 0;
  for (let i = 0; i < n; i++) for (let q = 0; q < m; q++) if (group[idx[i * m + q]] === group[i]) s++;
  return s / (n * m);
}

/** Mean fraction of each point's k high-D neighbours that are also among its k nearest in 2D. */
export function knnKept(y: Float64Array, g: Knn): number {
  const { n, k } = g, idx = knn2d(y, k);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const hi = new Set<number>();
    for (let q = 0; q < k; q++) hi.add(g.idx[i * k + q]);
    for (let q = 0; q < k; q++) if (hi.has(idx[i * k + q])) s++;
  }
  return s / (n * k);
}
