// Pure maths for the twolines demo (no DOM, so it can be unit-tested with node).
// Two equations a·x1 + b·x2 = c are classified by one elimination step,
// R2 -> R2 - m·R1, exactly as on the slides: the leftover row 0 = r tells
// "no solution" (r ≠ 0) from "infinitely many" (r = 0). No determinants.
export interface Eq { a: number; b: number; c: number }
export type P2 = [number, number];
export type Kind = "unique" | "none" | "infinite";
export type Why =
  | "cross"         // lines cross once
  | "parallel"      // parallel, distinct lines
  | "same"          // the same line written twice
  | "impossible"    // an equation with no x1, x2 reads 0 = c, c ≠ 0
  | "noconstraint"  // one equation reads 0 = 0, the other is a line
  | "plane";        // both equations read 0 = 0

export interface Result {
  kind: Kind;
  why: Why;
  x: P2 | null;           // the crossing point (unique case)
  zeroRow: 0 | 1 | null;  // an equation with a = b = 0 (the first such)
  pivot: 0 | 1 | null;    // column eliminated with R1 (0 = x1, 1 = x2)
  m: number | null;       // multiplier in R2 - m·R1
  red: Eq | null;         // R2 after elimination (red[pivot] = 0)
  angle: number | null;   // angle between the two lines, degrees (0..90)
}

export const TOL = 1e-9;
const zero = (v: number, scale = 1) => Math.abs(v) <= TOL * Math.max(1, scale);
export const isZeroRow = (e: Eq) => zero(e.a) && zero(e.b);
const coef = (e: Eq, j: 0 | 1) => (j === 0 ? e.a : e.b);

/** Angle between the two lines in degrees, or null if one is not a line. */
export function angleBetween(e1: Eq, e2: Eq): number | null {
  if (isZeroRow(e1) || isZeroRow(e2)) return null;
  const cross = Math.abs(e1.a * e2.b - e2.a * e1.b), dot = Math.abs(e1.a * e2.a + e1.b * e2.b);
  return Math.atan2(cross, dot) * 180 / Math.PI;
}

export function classify(e1: Eq, e2: Eq): Result {
  const base = { x: null, zeroRow: null, pivot: null, m: null, red: null, angle: angleBetween(e1, e2) };
  const z1 = isZeroRow(e1), z2 = isZeroRow(e2);
  if (z1 && z2) {
    if (zero(e1.c) && zero(e2.c)) return { ...base, kind: "infinite", why: "plane", zeroRow: 0 };
    return { ...base, kind: "none", why: "impossible", zeroRow: zero(e1.c) ? 1 : 0 };
  }
  if (z1 || z2) {
    const zr: 0 | 1 = z1 ? 0 : 1, Z = z1 ? e1 : e2;
    return zero(Z.c) ? { ...base, kind: "infinite", why: "noconstraint", zeroRow: zr }
      : { ...base, kind: "none", why: "impossible", zeroRow: zr };
  }
  // Both are lines: eliminate the pivot column of R1 from R2.
  const p: 0 | 1 = zero(e1.a) ? 1 : 0, q: 0 | 1 = p === 0 ? 1 : 0;
  const m = coef(e2, p) / coef(e1, p);
  const L = coef(e2, q) - m * coef(e1, q), r = e2.c - m * e1.c;
  const red: Eq = p === 0 ? { a: 0, b: L, c: r } : { a: L, b: 0, c: r };
  const sc = Math.max(Math.abs(coef(e2, q)), Math.abs(m * coef(e1, q)));
  const elim = { ...base, pivot: p, m, red };
  if (zero(L, sc)) {
    const scr = Math.max(Math.abs(e2.c), Math.abs(m * e1.c));
    if (zero(r, scr)) return { ...elim, red: { a: 0, b: 0, c: 0 }, kind: "infinite", why: "same" };
    return { ...elim, red: { a: 0, b: 0, c: r }, kind: "none", why: "parallel" };
  }
  const xq = r / L, xp = (e1.c - coef(e1, q) * xq) / coef(e1, p);
  const x: P2 = p === 0 ? [xp, xq] : [xq, xp];
  return { ...elim, kind: "unique", why: "cross", x };
}

/** Residuals a·x1 + b·x2 - c of both equations at a point. */
export const residual = (e: Eq, x: P2) => e.a * x[0] + e.b * x[1] - e.c;

/** The part of the line a·x1 + b·x2 = c inside the box [lo,hi]², or null. */
export function clipLine(e: Eq, lo: number, hi: number): [P2, P2] | null {
  const nn = e.a * e.a + e.b * e.b;
  if (nn < TOL) return null;
  const p0: P2 = [e.a * e.c / nn, e.b * e.c / nn], d: P2 = [-e.b, e.a];
  let t0 = -Infinity, t1 = Infinity;
  for (const k of [0, 1] as const) {
    if (Math.abs(d[k]) < 1e-15) { if (p0[k] < lo || p0[k] > hi) return null; continue; }
    let ta = (lo - p0[k]) / d[k], tb = (hi - p0[k]) / d[k];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return null;
  return [[p0[0] + t0 * d[0], p0[1] + t0 * d[1]], [p0[0] + t1 * d[0], p0[1] + t1 * d[1]]];
}

/** Closest point on the line to q, clamped to the part inside [lo,hi]². */
export function anchorOn(e: Eq, q: P2, lo: number, hi: number): P2 | null {
  const seg = clipLine(e, lo, hi);
  if (!seg) return null;
  const [A, B] = seg, d: P2 = [B[0] - A[0], B[1] - A[1]], dd = d[0] * d[0] + d[1] * d[1];
  if (dd < 1e-12) return A;
  const t = Math.max(0, Math.min(1, ((q[0] - A[0]) * d[0] + (q[1] - A[1]) * d[1]) / dd));
  return [A[0] + t * d[0], A[1] + t * d[1]];
}

export const round = (v: number, step: number) => {
  const r = Math.round(v / step) * step;
  return Math.round(r * 1e6) / 1e6 + 0;   // clean float noise, no -0
};

/** If the left sides are proportional, eLeft = k·other, return k (else null). */
export function ratio(e: Eq, other: Eq): number | null {
  if (isZeroRow(e) || isZeroRow(other)) return null;
  const k = Math.abs(other.a) >= Math.abs(other.b) ? e.a / other.a : e.b / other.b;
  const sc = Math.max(Math.abs(e.a), Math.abs(e.b), 1);
  return zero(e.a - k * other.a, sc) && zero(e.b - k * other.b, sc) ? k : null;
}

/** Snap c: to the other line (same line) when parallel and close, else to a 0.5 grid. */
export function snapC(e: Eq, other: Eq, c: number, near = 0.3): number {
  const k = ratio(e, other), n = Math.hypot(e.a, e.b);
  if (k !== null && Math.abs(c - k * other.c) / n < near) return round(k * other.c, 1e-6);
  return round(c, 0.5);
}

/** Drag the "shift" handle to point q: keep a, b; set c so the line passes near q. */
export function shiftTo(e: Eq, other: Eq, q: P2): Eq {
  return { a: e.a, b: e.b, c: snapC(e, other, e.a * q[0] + e.b * q[1]) };
}

/**
 * Drag the "turn" handle to q, turning the line about the pivot point. a and b
 * snap to: a copy of the other line's a, b (when within `snapDeg` of parallel),
 * horizontal / vertical, or else a 0.1 grid with max(|a|,|b|) kept. c snaps
 * to the other line (same line) when close, else to a 0.5 grid.
 */
export function turnTo(e: Eq, other: Eq, pivot: P2, q: P2, snapDeg = 4): Eq {
  const dx = q[0] - pivot[0], dy = q[1] - pivot[1];
  if (Math.hypot(dx, dy) < 0.3) return e;
  let n: P2 = [dy, -dx];                                  // normal of the new direction
  if (n[0] * e.a + n[1] * e.b < 0) n = [-n[0], -n[1]];    // keep the sign pattern
  const M = Math.max(1, round(Math.max(Math.abs(e.a), Math.abs(e.b)), 0.5));
  const ang = (u: P2, v: P2) => {
    const c = Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
    return Math.acos(Math.min(1, c)) * 180 / Math.PI;
  };
  let a: number, b: number;
  if (!isZeroRow(other) && ang(n, [other.a, other.b]) < snapDeg) {
    const s = n[0] * other.a + n[1] * other.b >= 0 ? 1 : -1;
    a = s * other.a; b = s * other.b;
  } else if (ang(n, [1, 0]) < snapDeg) { a = Math.sign(n[0]) * M; b = 0; }
  else if (ang(n, [0, 1]) < snapDeg) { a = 0; b = Math.sign(n[1]) * M; }
  else {
    const s = M / Math.max(Math.abs(n[0]), Math.abs(n[1]));
    a = round(n[0] * s, 0.1); b = round(n[1] * s, 0.1);
  }
  a += 0; b += 0;
  const t: Eq = { a, b, c: 0 };
  const cRaw = a * pivot[0] + b * pivot[1];
  const k = ratio(t, other);
  t.c = k !== null && Math.abs(cRaw - k * other.c) / Math.hypot(a, b) < 0.3 ? round(k * other.c, 1e-6) : round(cRaw, 0.5);
  return t;
}

/** Number formatting: up to `d` decimals, trailing zeros dropped, a real minus sign. */
export function fmt(v: number, d = 3): string {
  if (!Number.isFinite(v)) return "∞";
  let s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace("-", "−");
}

/** A multiplier as a small fraction when it is one (1/3, 1/2, 5/2), else a decimal. */
export function fmtFrac(v: number): string {
  for (let den = 1; den <= 12; den++) {
    const num = Math.round(v * den);
    if (Math.abs(v * den - num) < 1e-9) {
      if (den === 1) return fmt(num);
      return `${num < 0 ? "−" : ""}${Math.abs(num)}/${den}`;
    }
  }
  return fmt(v);
}
