// Pure 2-D vector maths for the vecmini demo (no DOM).
export type V2 = [number, number];

export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const mul = (k: number, a: V2): V2 => [k * a[0], k * a[1]];
export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
export const norm = (a: V2): number => Math.hypot(a[0], a[1]);

/** Angle between u and v in degrees (0..180), or null if one of them is the zero vector. */
export function angleDeg(u: V2, v: V2): number | null {
  const nu = norm(u), nv = norm(v);
  if (nu < 1e-12 || nv < 1e-12) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (nu * nv)))) * 180 / Math.PI;
}

/** Columns of the rotation matrix R(θ): R(θ)e₁ and R(θ)e₂. */
export function rotCols(deg: number): [V2, V2] {
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return [[c, s], [-s, c]];
}

/** Number for display: integers without decimals, otherwise up to `dp` decimals; true minus sign. */
export function fmt(x: number, dp = 2): string {
  const r = Number(x.toFixed(dp));
  const s = Object.is(r, -0) ? "0" : String(r);
  return s.replace("-", "−");
}

/** Fixed number of decimals (for the matrix entries, so the columns do not jump). */
export function fmtFixed(x: number, dp = 2): string {
  const s = x.toFixed(dp);
  return (Number(s) === 0 ? (0).toFixed(dp) : s).replace("-", "−");
}

export const vec = (a: V2, dp = 2): string => `(${fmt(a[0], dp)}, ${fmt(a[1], dp)})`;
