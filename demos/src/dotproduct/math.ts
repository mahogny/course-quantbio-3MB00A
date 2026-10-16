// Pure 2-D vector maths for the dotproduct demo (no DOM, so it can be unit-tested).
export type V2 = [number, number];

export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
export const norm = (a: V2): number => Math.hypot(a[0], a[1]);
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const mul = (k: number, a: V2): V2 => [k * a[0], k * a[1]];

export interface Stats {
  dot: number; nu: number; nv: number;
  cos: number | null;      // null when a vector has length 0
  deg: number | null;
  dist: number;
  coef: number | null;     // u·v / v·v, null when v = 0
  proj: V2 | null;         // projection of u onto v
  sign: 1 | 0 | -1;        // sign of u·v, with a tolerance for rounding
}

export function stats(u: V2, v: V2): Stats {
  const d = dot(u, v), nu = norm(u), nv = norm(v);
  const ok = nu > 1e-12 && nv > 1e-12;
  const cos = ok ? Math.max(-1, Math.min(1, d / (nu * nv))) : null;
  const deg = cos === null ? null : Math.acos(cos) * 180 / Math.PI;
  const vv = dot(v, v);
  const coef = vv > 1e-12 ? d / vv : null;
  const tol = 1e-9 * Math.max(1, nu * nv);
  return {
    dot: d, nu, nv, cos, deg, dist: norm(sub(u, v)), coef,
    proj: coef === null ? null : mul(coef, v),
    sign: Math.abs(d) <= tol ? 0 : d > 0 ? 1 : -1,
  };
}

/** Round to a grid (step > 0), or to 2 decimals when step = 0. */
export function snap(x: number, step: number): number {
  const s = step > 0 ? step : 0.01;
  return Math.round(x / s) * s;
}

/** Number for display: integers without decimals, otherwise up to `dp` decimals. */
export function fmt(x: number, dp = 2): string {
  const r = Number(x.toFixed(dp));
  const s = Object.is(r, -0) ? "0" : String(r);
  return s.replace("-", "−");
}

/** Number in a sum, wrapped in brackets when negative: 3·(−2). */
export function fmtP(x: number, dp = 2): string {
  const s = fmt(x, dp);
  return s.startsWith("−") ? `(${s})` : s;
}
