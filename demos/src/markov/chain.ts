// Pure Markov-chain maths for the "markov" demo (no DOM), so it can be unit-tested.
// Convention (as in the lectures): P is row-stochastic, p[i][j] = prob. from i to j,
// distributions are row vectors and one step is x_{t+1} = x_t P.

export type Mat = number[][];

export interface Chain { label: string; states: string[]; P: Mat; start?: number }

/** One step of a distribution: (x P)_j = sum_i x_i p_ij. */
export function stepDist(x: number[], P: Mat): number[] {
  const n = x.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) y[j] += x[i] * P[i][j];
  return y;
}

/**
 * Stationary distribution: solve pi (P - I) = 0 with sum(pi) = 1 by Gaussian elimination.
 * Returns null when it is not unique (e.g. two separate groups of states).
 */
export function stationary(P: Mat): number[] | null {
  const n = P.length;
  // Equations (P^T - I) pi^T = 0; replace the last one by sum(pi) = 1.
  const A: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(r === n - 1 ? 1 : P[c][r] - (r === c ? 1 : 0));
    row.push(r === n - 1 ? 1 : 0);
    A.push(row);
  }
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-9) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const pi = A.map((row, i) => row[n] / row[i]);
  return pi.map(v => (Math.abs(v) < 1e-12 ? 0 : v));
}

/**
 * Set p[i][j] = v and rescale the other entries of row i so the row still sums to 1
 * (if they were all zero, share 1 - v equally among them).
 */
export function setEntry(P: Mat, i: number, j: number, v: number): void {
  const n = P.length;
  v = Math.min(1, Math.max(0, v));
  const rest = 1 - v;
  let others = 0;
  for (let k = 0; k < n; k++) if (k !== j) others += P[i][k];
  for (let k = 0; k < n; k++) {
    if (k === j) P[i][k] = v;
    else P[i][k] = others > 1e-12 ? P[i][k] * rest / others : rest / (n - 1);
  }
}

/** Sample the next state from row `row` of P with a uniform number u in [0,1). */
export function sampleRow(row: number[], u: number): number {
  let acc = 0;
  for (let j = 0; j < row.length; j++) {
    acc += row[j];
    if (u < acc) return j;
  }
  // rounding: return the last state with positive probability
  for (let j = row.length - 1; j >= 0; j--) if (row[j] > 0) return j;
  return row.length - 1;
}

/** Normalise every row to sum 1 (used on data-* input). */
export function normaliseRows(P: Mat): Mat {
  return P.map(r => {
    const s = r.reduce((a, b) => a + Math.max(0, b), 0);
    return s > 0 ? r.map(v => Math.max(0, v) / s) : r.map(() => 1 / r.length);
  });
}

/** Built-in chains, selectable by key in data-presets. */
export const PRESETS: Record<string, Chain> = {
  // Markov chains lecture: resting / dividing cell
  lecture: { label: "Lecture R/D", states: ["R", "D"], P: [[0.9, 0.1], [0.5, 0.5]] },
  // Exercise cell model
  cell: { label: "Cell model", states: ["R", "D"], P: [[0.8, 0.2], [0.6, 0.4]] },
  // Exercise 3-state DNA chain over A, C, G
  dna3: { label: "DNA A,C,G", states: ["A", "C", "G"], P: [[0.1, 0.6, 0.3], [0.4, 0.4, 0.2], [0.5, 0.5, 0]], start: 1 },
  // Markov chains in R: 4-state DNA chain with a CpG-like dip
  dna4: {
    label: "DNA A,C,G,T", states: ["A", "C", "G", "T"],
    P: [[0.30, 0.20, 0.25, 0.25], [0.25, 0.35, 0.05, 0.35], [0.25, 0.25, 0.25, 0.25], [0.15, 0.30, 0.25, 0.30]],
  },
  fast: { label: "Fast mixing", states: ["R", "D"], P: [[0.5, 0.5], [0.5, 0.5]] },
  sticky: { label: "Sticky", states: ["R", "D"], P: [[0.97, 0.03], [0.05, 0.95]] },
  absorbing: {
    label: "Absorbing", states: ["stem", "prog", "diff"],
    P: [[0.7, 0.3, 0], [0, 0.6, 0.4], [0, 0, 1]],
  },
  periodic: { label: "Periodic", states: ["1", "2"], P: [[0, 1], [1, 0]] },
};
