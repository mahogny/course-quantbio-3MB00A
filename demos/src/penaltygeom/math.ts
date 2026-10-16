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
