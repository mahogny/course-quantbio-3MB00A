// Pure 2D PCA helpers (no DOM), so they can be unit-tested with node.
export type Pt = [number, number];

/** Sample covariance (divisor n-1) of 2D points, plus the mean. */
export interface Cov { a: number; b: number; d: number; mx: number; my: number; n: number }

export function cov(pts: Pt[]): Cov {
  const n = pts.length;
  let mx = 0, my = 0;
  for (const [x, y] of pts) { mx += x; my += y; }
  mx /= n; my /= n;
  let a = 0, b = 0, d = 0;
  for (const [x, y] of pts) {
    const u = x - mx, v = y - my;
    a += u * u; b += u * v; d += v * v;
  }
  const k = n > 1 ? n - 1 : 1;
  return { a: a / k, b: b / k, d: d / k, mx, my, n };
}

/** Variance of the points along the unit direction at angle theta (radians). */
export function varAlong(c: Cov, theta: number): number {
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return c.a * cs * cs + 2 * c.b * cs * sn + c.d * sn * sn;
}

export interface PcaResult {
  theta1: number;   // angle of PC1 in (-pi/2, pi/2]
  l1: number;       // variance along PC1 (largest eigenvalue)
  l2: number;       // variance along PC2
  total: number;    // total variance = trace = l1 + l2
}

/** Exact PCA of a 2x2 symmetric covariance matrix (closed form). */
export function pca(c: Cov): PcaResult {
  const total = c.a + c.d;
  const half = (c.a - c.d) / 2;
  const r = Math.sqrt(half * half + c.b * c.b);
  let theta1 = 0.5 * Math.atan2(2 * c.b, c.a - c.d);
  if (theta1 <= -Math.PI / 2) theta1 += Math.PI;
  return { theta1, l1: total / 2 + r, l2: Math.max(0, total / 2 - r), total };
}

/** Divide each variable by its SD after centring. */
export function standardise(pts: Pt[]): { pts: Pt[]; sd: Pt } {
  const c = cov(pts);
  const sx = Math.sqrt(c.a) || 1, sy = Math.sqrt(c.d) || 1;
  return { pts: pts.map(([x, y]) => [(x - c.mx) / sx, (y - c.my) / sy] as Pt), sd: [sx, sy] };
}

/** Score (signed projection) of point p onto the axis through m at angle theta. */
export function score(p: Pt, m: Pt, theta: number): number {
  return (p[0] - m[0]) * Math.cos(theta) + (p[1] - m[1]) * Math.sin(theta);
}

/** Degrees in [0, 180) for an undirected axis angle in radians. */
export function axisDeg(theta: number): number {
  let d = (theta * 180) / Math.PI;
  d = ((d % 180) + 180) % 180;
  return d >= 179.95 ? 0 : d;
}
