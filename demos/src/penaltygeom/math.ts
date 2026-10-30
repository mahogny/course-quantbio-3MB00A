// Pure maths for the penalty-geometry demo (no DOM), so it can be tested with node.
// Two standardized predictors with correlation r, so X^T X = G = [[1, r], [r, 1]] (per sample).
// RSS(beta) = (beta - b)^T G (beta - b) + const, with b the OLS point.
// Penalized objective (the decks' notation):
//   RSS(beta) + lambda * [ alpha * (|b1| + |b2|) + (1 - alpha) * (b1^2 + b2^2) ].

export type V2 = [number, number];

/** Excess RSS over the OLS minimum: (beta - b)^T G (beta - b). */
export function rss(beta: V2, b: V2, r: number): number {
  const d0 = beta[0] - b[0], d1 = beta[1] - b[1];
  return d0 * d0 + 2 * r * d0 * d1 + d1 * d1;
}

/** The penalty alpha*L1 + (1-alpha)*L2^2 (without lambda). */
export function pen(beta: V2, alpha: number): number {
  return alpha * (Math.abs(beta[0]) + Math.abs(beta[1])) + (1 - alpha) * (beta[0] ** 2 + beta[1] ** 2);
}

export function objective(beta: V2, b: V2, r: number, lambda: number, alpha: number): number {
  return rss(beta, b, r) + lambda * pen(beta, alpha);
}

const soft = (z: number, g: number) => (z > g ? z - g : z < -g ? z + g : 0);

/** Penalized solution by coordinate descent (exact zeros from soft-thresholding). */
export function solve(b: V2, r: number, lambda: number, alpha: number, start: V2 = [0, 0]): V2 {
  const Gb: V2 = [b[0] + r * b[1], r * b[0] + b[1]];
  const den = 1 + lambda * (1 - alpha), g = lambda * alpha / 2;
  let x0 = start[0], x1 = start[1];
  for (let it = 0; it < 20000; it++) {
    const n0 = soft(Gb[0] - r * x1, g) / den;
    const n1 = soft(Gb[1] - r * n0, g) / den;
    const ch = Math.abs(n0 - x0) + Math.abs(n1 - x1);
    x0 = n0; x1 = n1;
    if (ch < 1e-13) break;
  }
  return [x0, x1];
}

/** Ridge closed form (G + lambda I)^{-1} G b, for checking. */
export function ridgeClosed(b: V2, r: number, lambda: number): V2 {
  const Gb: V2 = [b[0] + r * b[1], r * b[0] + b[1]];
  const a = 1 + lambda, det = a * a - r * r;
  return [(a * Gb[0] - r * Gb[1]) / det, (-r * Gb[0] + a * Gb[1]) / det];
}

/** Coefficient path over log10(lambda) values, warm-started. */
export function path(b: V2, r: number, alpha: number, logLams: number[]): V2[] {
  let cur: V2 = [0, 0];
  const out: V2[] = [];
  for (const L of logLams) { cur = solve(b, r, 10 ** L, alpha, cur); out.push(cur); }
  return out;
}

/** Points on the boundary {alpha*|beta|_1 + (1-alpha)*|beta|_2^2 = s}. */
export function regionBoundary(s: number, alpha: number, m = 360): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i <= m; i++) {
    const th = 2 * Math.PI * i / m, c = Math.cos(th), si = Math.sin(th);
    const L = Math.abs(c) + Math.abs(si);
    let rho: number;
    if (alpha >= 1) rho = s / L;
    else if (alpha <= 0) rho = Math.sqrt(s);
    else rho = (-alpha * L + Math.sqrt(alpha * alpha * L * L + 4 * (1 - alpha) * s)) / (2 * (1 - alpha));
    pts.push([rho * c, rho * si]);
  }
  return pts;
}

/** Points on the ellipse (beta - b)^T G (beta - b) = c. */
export function ellipse(b: V2, r: number, c: number, m = 180): V2[] {
  // eigenvectors (1,1)/sqrt2 (eigenvalue 1+r) and (1,-1)/sqrt2 (eigenvalue 1-r)
  const a1 = Math.sqrt(c / (1 + r)), a2 = Math.sqrt(c / (1 - r)), s = Math.SQRT1_2;
  const pts: V2[] = [];
  for (let i = 0; i <= m; i++) {
    const th = 2 * Math.PI * i / m, u = a1 * Math.cos(th), v = a2 * Math.sin(th);
    pts.push([b[0] + s * (u + v), b[1] + s * (u - v)]);
  }
  return pts;
}

/**
 * Contour line segments of f = level on a grid over [x0,x1] x [y0,y1] (marching squares).
 * Returns a list of segments [[xa,ya],[xb,yb]].
 */
export function contour(f: (x: number, y: number) => number, level: number,
  x0: number, x1: number, y0: number, y1: number, nx = 120, ny = 120): [V2, V2][] {
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  const v = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v[j * (nx + 1) + i] = f(x0 + i * dx, y0 + j * dy) - level;
  const segs: [V2, V2][] = [];
  const lerp = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): V2 => {
    const t = va / (va - vb);
    return [xa + t * (xb - xa), ya + t * (yb - ya)];
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const xa = x0 + i * dx, xb = xa + dx, ya = y0 + j * dy, yb = ya + dy;
    const a = v[j * (nx + 1) + i], bq = v[j * (nx + 1) + i + 1];
    const c = v[(j + 1) * (nx + 1) + i + 1], d = v[(j + 1) * (nx + 1) + i];
    const pts: V2[] = [];
    if ((a < 0) !== (bq < 0)) pts.push(lerp(xa, ya, a, xb, ya, bq));
    if ((bq < 0) !== (c < 0)) pts.push(lerp(xb, ya, bq, xb, yb, c));
    if ((c < 0) !== (d < 0)) pts.push(lerp(xb, yb, c, xa, yb, d));
    if ((d < 0) !== (a < 0)) pts.push(lerp(xa, yb, d, xa, ya, a));
    if (pts.length === 2) segs.push([pts[0], pts[1]]);
    else if (pts.length === 4) { segs.push([pts[0], pts[1]]); segs.push([pts[2], pts[3]]); }
  }
  return segs;
}

// ---------------- data-mode="resample": refit on many small training sets ----------------
// Two genes x1, x2 with correlation r, y = x1 + x2 + noise (true beta = (1, 1)), no intercept
// (everything has mean 0 by construction). Fits use the decks' notation on the raw data:
//   OLS  : minimise RSS;   ridge: RSS + lambda * sum beta^2;   lasso: RSS + lambda * sum |beta|.

/** Sufficient statistics of one training set: A = X^T X (symmetric 2x2) and c = X^T y. */
export interface Stats2 { a11: number; a12: number; a22: number; c1: number; c2: number }

/** Standard normals for `draws` training sets of n samples: z1, z2, e per sample. */
export function baseNormals(norm: () => number, draws: number, n: number): Float64Array[] {
  const out: Float64Array[] = [];
  for (let k = 0; k < draws; k++) {
    const v = new Float64Array(3 * n);
    for (let i = 0; i < 3 * n; i++) v[i] = norm();
    out.push(v);
  }
  return out;
}

/** Turn base normals into a data set with correlation r and noise sd sigma; returns its stats and points. */
export function makeData(z: Float64Array, r: number, sigma: number, beta: V2 = [1, 1]): { s: Stats2; x: V2[] } {
  const n = z.length / 3, q = Math.sqrt(1 - r * r);
  const s: Stats2 = { a11: 0, a12: 0, a22: 0, c1: 0, c2: 0 };
  const x: V2[] = [];
  for (let i = 0; i < n; i++) {
    const x1 = z[3 * i], x2 = r * z[3 * i] + q * z[3 * i + 1];
    const y = beta[0] * x1 + beta[1] * x2 + sigma * z[3 * i + 2];
    s.a11 += x1 * x1; s.a12 += x1 * x2; s.a22 += x2 * x2; s.c1 += x1 * y; s.c2 += x2 * y;
    x.push([x1, x2]);
  }
  return { s, x };
}

/** Ridge (A + lambda I)^{-1} c; lambda = 0 gives OLS. */
export function ridgeFit(s: Stats2, lambda: number): V2 {
  const a = s.a11 + lambda, d = s.a22 + lambda, det = a * d - s.a12 * s.a12;
  return [(d * s.c1 - s.a12 * s.c2) / det, (-s.a12 * s.c1 + a * s.c2) / det];
}

/** Lasso, exact for two coefficients: try every pattern of zero / sign and keep the best valid one. */
export function lassoFit(s: Stats2, lambda: number): V2 {
  const g = lambda / 2;
  const obj = (b: V2) => s.a11 * b[0] * b[0] + 2 * s.a12 * b[0] * b[1] + s.a22 * b[1] * b[1]
    - 2 * (s.c1 * b[0] + s.c2 * b[1]) + lambda * (Math.abs(b[0]) + Math.abs(b[1]));
  const cands: V2[] = [[0, 0], [soft(s.c1, g) / s.a11, 0], [0, soft(s.c2, g) / s.a22]];
  const det = s.a11 * s.a22 - s.a12 * s.a12;
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    const u = s.c1 - g * s1, v = s.c2 - g * s2;
    const b: V2 = [(s.a22 * u - s.a12 * v) / det, (-s.a12 * u + s.a11 * v) / det];
    if (Math.sign(b[0]) === s1 && Math.sign(b[1]) === s2) cands.push(b);
  }
  let best = cands[0], bo = obj(best);
  for (const b of cands) { const o = obj(b); if (o < bo - 1e-12) { best = b; bo = o; } }
  return best;
}

// ---------------- data-mode="prior1d": one coefficient ----------------
// sigma^2 = 1 and a standardized predictor, so RSS(beta) = n (beta - est)^2 + const and
//   -2 log posterior = n (beta - est)^2 + penalty(beta) + const.
// Gaussian prior with sd w:  penalty = beta^2 / w^2         -> ridge with lambda = 1 / w^2.
// Laplace prior with sd w (scale b = w / sqrt 2): penalty = 2|beta| / b -> lasso with lambda = 2 / b.

export type Prior = "gauss" | "laplace";

export function lambdaOf(prior: Prior, w: number): number {
  return prior === "gauss" ? 1 / (w * w) : 2 * Math.SQRT2 / w;
}

/** The penalty lambda*beta^2 or lambda*|beta| (= -2 log prior + const). */
export function penalty1(prior: Prior, lambda: number, beta: number): number {
  return prior === "gauss" ? lambda * beta * beta : lambda * Math.abs(beta);
}

/** Posterior peak (MAP) = penalized estimate. Laplace: exactly 0 when |est| <= lambda / (2n). */
export function map1(prior: Prior, lambda: number, n: number, est: number): number {
  return prior === "gauss" ? n * est / (n + lambda) : soft(n * est, lambda / 2) / n;
}
