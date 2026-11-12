// Pure maths for the row-operation demos (elimination, inverse): no DOM, so it can be
// tested with node. Exact fractions throughout. A run produces a list of Steps; the UI
// (rowopsui.ts) turns each into words, notation and highlighted matrices.
//  - solveSteps(A, b): Gaussian elimination on [A | b] to row-echelon form, then
//    back-substitution (or: no solution / infinitely many).
//  - inverseSteps(A): Gauss–Jordan on [A | I] to [I | A⁻¹] (or: no inverse).
// Pivots are taken in order; a row swap happens only when the pivot spot holds 0
// (the rule used by hand). No determinants anywhere.
import { Frac, ZERO, ONE } from "./frac";

export type M = Frac[][];

/** One row operation. Rows and columns are 0-based here; the UI shows R1, R2, ... */
export type Op =
  | { kind: "swap"; i: number; j: number; col: number }
  /** R[target] ← R[target] − m·R[src], making a 0 at (target, col) below/above the pivot (src, col). */
  | { kind: "elim"; target: number; src: number; col: number; m: Frac; dir: "below" | "above" }
  /** R[row] ← R[row] ÷ pivot, making the pivot (row, col) equal 1. */
  | { kind: "scale"; row: number; col: number; pivot: Frac };

/** One unknown solved from one row of the echelon form. */
export interface BackSub {
  row: number; col: number; pivot: Frac; rhs: Frac;
  known: { col: number; coef: Frac; value: Frac }[];  // other non-zero terms, values already found
  moved: Frac;  // rhs − Σ coef·value
  value: Frac;  // moved ÷ pivot
}

export interface Check { coefs: Frac[]; rhs: Frac; total: Frac }

export type Step =
  | { phase: "start"; mat: M }
  | { phase: "op"; op: Op; before: M; mat: M; note?: string }
  /** Column has no non-zero entry at or below row `row`: no pivot, move on. */
  | { phase: "nopivot"; col: number; row: number; mat: M }
  /** Every entry below the pivot is already 0. */
  | { phase: "clear"; col: number; row: number; mat: M }
  | { phase: "echelon"; mat: M; pivotCols: number[]; already: boolean }
  | { phase: "back"; mat: M; sub: BackSub; solved: (Frac | null)[] }
  | { phase: "check"; mat: M; x: Frac[]; checks: Check[] }
  | { phase: "none"; mat: M; row: number }
  | { phase: "infinite"; mat: M; zeroRows: number[]; free: number[]; pivotCols: number[]; example: Frac[] }
  | { phase: "singular"; mat: M; zeroRows: number[] }
  | { phase: "identity"; mat: M; inv: M }
  | { phase: "invcheck"; mat: M; A: M; inv: M; prod: M };

export const cloneM = (m: M): M => m.map(r => r.slice());
export const toM = (rows: number[][]): M => rows.map(r => r.map(v => Frac.of(v)));
export const identity = (n: number): M =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)));

export function matMul(A: M, B: M): M {
  return A.map(row => B[0].map((_, j) => row.reduce((s, a, k) => s.add(a.mul(B[k][j])), ZERO)));
}

function apply(mat: M, op: Op): M {
  const out = cloneM(mat);
  if (op.kind === "swap") [out[op.i], out[op.j]] = [out[op.j], out[op.i]];
  else if (op.kind === "elim") out[op.target] = mat[op.target].map((v, k) => v.sub(op.m.mul(mat[op.src][k])));
  else out[op.row] = mat[op.row].map(v => v.div(op.pivot));
  return out;
}

/** Forward elimination of the first `nLeft` columns. Appends steps; returns pivot column per pivot row. */
function forward(mat: M, nLeft: number, steps: Step[]): { mat: M; pivotCols: number[] } {
  const rows = mat.length, pivotCols: number[] = [];
  let r = 0;
  const push = (op: Op, note?: string) => {
    const before = mat;
    mat = apply(mat, op);
    steps.push({ phase: "op", op, before, mat, note });
  };
  for (let c = 0; c < nLeft && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) if (!mat[i][c].isZero()) { p = i; break; }
    if (p < 0) { steps.push({ phase: "nopivot", col: c, row: r, mat }); continue; }
    if (p !== r) push({ kind: "swap", i: r, j: p, col: c });
    const already: number[] = [];
    let did = false;
    for (let i = r + 1; i < rows; i++) {
      if (mat[i][c].isZero()) { already.push(i); continue; }
      const note = !did && already.length ? already.map(k => `R${k + 1}`).join(" and ") : undefined;
      push({ kind: "elim", target: i, src: r, col: c, m: mat[i][c].div(mat[r][c]), dir: "below" }, note);
      did = true;
    }
    if (!did && r + 1 < rows) steps.push({ phase: "clear", col: c, row: r, mat });
    pivotCols.push(c);
    r++;
  }
  return { mat, pivotCols };
}

const zeroLeft = (row: Frac[], nLeft: number) => row.slice(0, nLeft).every(v => v.isZero());

/** Back-substitution from the bottom pivot row up; free unknowns get `freeValue`. */
function backSub(mat: M, pivotCols: number[], n: number, steps: Step[] | null, freeValue = ZERO): Frac[] {
  const x: (Frac | null)[] = Array(n).fill(null);
  for (let c = 0; c < n; c++) if (!pivotCols.includes(c)) x[c] = freeValue;
  for (let r = pivotCols.length - 1; r >= 0; r--) {
    const c = pivotCols[r], row = mat[r];
    const known: BackSub["known"] = [];
    let moved = row[n];
    for (let k = c + 1; k < n; k++) {
      if (row[k].isZero()) continue;
      known.push({ col: k, coef: row[k], value: x[k]! });
      moved = moved.sub(row[k].mul(x[k]!));
    }
    x[c] = moved.div(row[c]);
    if (steps) steps.push({
      phase: "back", mat, solved: x.slice(),
      sub: { row: r, col: c, pivot: row[c], rhs: row[n], known, moved, value: x[c]! },
    });
  }
  return x as Frac[];
}

/** Gaussian elimination on [A | b], then back-substitution and a check. */
export function solveSteps(A: M, b: Frac[]): Step[] {
  const n = A[0].length;
  const start: M = A.map((r, i) => [...r, b[i]]);
  const steps: Step[] = [{ phase: "start", mat: start }];
  const { mat, pivotCols } = forward(start, n, steps);
  steps.push({ phase: "echelon", mat, pivotCols, already: steps.length === 1 || steps.every(s => s.phase !== "op") });
  const bad = mat.findIndex(r => zeroLeft(r, n) && !r[n].isZero());
  if (bad >= 0) { steps.push({ phase: "none", mat, row: bad }); return steps; }
  if (pivotCols.length < n) {
    const zeroRows = mat.map((r, i) => i).filter(i => zeroLeft(mat[i], n));
    const free = [...Array(n).keys()].filter(c => !pivotCols.includes(c));
    steps.push({ phase: "infinite", mat, zeroRows, free, pivotCols, example: backSub(mat, pivotCols, n, null) });
    return steps;
  }
  const x = backSub(mat, pivotCols, n, steps);
  const checks = A.map((row, i) => ({
    coefs: row, rhs: b[i], total: row.reduce((s, a, k) => s.add(a.mul(x[k])), ZERO),
  }));
  steps.push({ phase: "check", mat, x, checks });
  return steps;
}

/** Gauss–Jordan on [A | I]: forward elimination, then from the bottom pivot up: scale to 1, clear above. */
export function inverseSteps(A: M): Step[] {
  const n = A.length, I = identity(n);
  const start: M = A.map((r, i) => [...r, ...I[i]]);
  const steps: Step[] = [{ phase: "start", mat: start }];
  let { mat, pivotCols } = forward(start, n, steps);
  if (pivotCols.length < n) {
    steps.push({ phase: "singular", mat, zeroRows: mat.map((_, i) => i).filter(i => zeroLeft(mat[i], n)) });
    return steps;
  }
  steps.push({ phase: "echelon", mat, pivotCols, already: steps.every(s => s.phase !== "op") });
  for (let c = n - 1; c >= 0; c--) {
    if (!mat[c][c].isOne()) {
      const op: Op = { kind: "scale", row: c, col: c, pivot: mat[c][c] }, before = mat;
      mat = apply(mat, op);
      steps.push({ phase: "op", op, before, mat });
    }
    for (let r = c - 1; r >= 0; r--) {
      if (mat[r][c].isZero()) continue;
      const op: Op = { kind: "elim", target: r, src: c, col: c, m: mat[r][c], dir: "above" }, before = mat;
      mat = apply(mat, op);
      steps.push({ phase: "op", op, before, mat });
    }
  }
  const inv = mat.map(r => r.slice(n));
  steps.push({ phase: "identity", mat, inv });
  steps.push({ phase: "invcheck", mat, A, inv, prod: matMul(A, inv) });
  return steps;
}

// ---------------------------------------------------------------------------
// Random systems with small-integer answers and whole-number steps.
// A = L·U with L unit lower-triangular (integer multipliers) and U upper-triangular,
// so plain elimination meets exactly the multipliers in L: every step is whole-number.

export type Kind = "unique" | "swap" | "none" | "infinite";

const pick = <T>(u: () => number, xs: readonly T[]): T => xs[Math.floor(u() * xs.length)];

function lu(n: number, u: () => number, diag: readonly number[]): { L: number[][]; U: number[][] } {
  const L = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
    i === j ? 1 : j < i ? pick(u, [-2, -1, 0, 1, 1, 2, 2, 3]) : 0));
  const U = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) =>
    i === j ? pick(u, diag) : j > i ? pick(u, [-2, -1, 0, 1, 1, 2, 3]) : 0));
  return { L, U };
}

function mulInt(A: number[][], B: number[][]): number[][] {
  return A.map(r => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));
}

/**
 * A random n×n matrix of the given kind. `swap`: a pivot spot holds 0 (in column 1, or for
 * n ≥ 3 sometimes in column 2). `none`/`infinite`: the last row is a combination of the others.
 */
export function randomMatrix(n: number, kind: Kind, u: () => number, diag: readonly number[]): number[][] {
  const limit = n <= 2 ? 9 : n === 3 ? 10 : 14;
  for (let tries = 0; tries < 500; tries++) {
    const { L, U } = lu(n, u, diag);
    let swapAt = -1;
    if (kind === "swap") {
      swapAt = n >= 3 && u() < 0.5 ? 1 : 0;
      // Row swapAt+1 must not need row swapAt: then after clearing the earlier columns it
      // has a 0 exactly where row swapAt needs its pivot. Swapping the two rows back fixes it.
      L[swapAt + 1][swapAt] = 0;
    }
    const A = mulInt(L, U);
    if (swapAt >= 0) [A[swapAt], A[swapAt + 1]] = [A[swapAt + 1], A[swapAt]];
    if (kind === "none" || kind === "infinite") {
      const c = Array.from({ length: n - 1 }, () => pick<number>(u, [-1, 0, 1, 1, 2]));
      if (!c.some(v => v !== 0)) c[0] = 1;
      A[n - 1] = A[0].map((_, j) => c.reduce((s, ci, i) => s + ci * A[i][j], 0));
    }
    const flat = A.flat();
    if (flat.some(v => Math.abs(v) > limit)) continue;
    if (A.some(r => r.every(v => v === 0))) continue;
    if (flat.filter(v => v === 0).length > Math.floor(n * n / 3)) continue;
    // Columns that are all zero would make a dull "free unknown"; avoid.
    if (A[0].some((_, j) => A.every(r => r[j] === 0))) continue;
    return A;
  }
  return identity(n).map(r => r.map(v => Number(v.n)));
}

/** A random system A·(x, y, z, …) = b with a small-integer answer (when there is one). */
export function randomSystem(n: number, kind: Kind, u: () => number): { A: number[][]; b: number[] } {
  const A = randomMatrix(n, kind, u, [1, 1, 1, 2, -1, 2, 3, -2]);
  const x = Array.from({ length: n }, () => pick(u, [-2, -1, 1, 1, 2, 2, 3, 3, 4, 5]));
  const b = A.map(r => r.reduce((s, a, k) => s + a * x[k], 0));
  if (kind === "none") b[n - 1] += pick(u, [-3, -2, -1, 1, 2, 3]);
  return { A, b };
}

/** A random invertible (or, kind "none", singular) matrix; pivots mostly ±1 so A⁻¹ has few fractions. */
export function randomInvertible(n: number, kind: "unique" | "swap" | "none", u: () => number): number[][] {
  return randomMatrix(n, kind, u, [1, 1, 1, -1, 2]);
}
