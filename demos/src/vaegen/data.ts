// Synthetic single-cell-like counts for the vaegen demo (and its training script train.ts).
// Fixed seed, so the browser regenerates exactly the cells the VAE was trained on.
//
// 1500 cells × 36 genes, 6 marker sets of 6 genes:
//   T-cell genes, B-cell genes, stem genes, progenitor genes, erythroid genes, housekeeping.
// Cells: 350 "T cell", 350 "B cell" (two separate clusters), and 800 cells along one
// continuous trajectory stem → progenitor → erythroid (pseudotime t uniform on [0, 1];
// stem genes fade out, progenitor genes peak half-way, erythroid genes switch on).
// Counts are negative binomial around a per-cell mean (all cells have the same depth).
import { rng } from "../lib/ui";
import { rnb } from "../nbdisp/stats";

export const SETS = ["T cell", "B cell", "stem", "progen.", "erythr.", "housek."];
export const GENES_PER_SET = 6;
export const N_GENES = SETS.length * GENES_PER_SET;
export const LABELS = ["T cell", "B cell", "stem", "progenitor", "erythroid"];
export const N_CELLS = 1500;

export interface CellData {
  counts: Float64Array[];   // per cell, N_GENES raw counts
  label: number[];          // index into LABELS
  t: number[];              // pseudotime for trajectory cells, NaN otherwise
  size: number[];           // true NB size (1/dispersion) per gene
}

/** Expected count of every gene for a cell of group g (0 T, 1 B, 2 trajectory) at pseudotime t. */
export function trueMean(level: number[], g: number, t: number, prog = 1): number[] {
  const m = new Array(N_GENES).fill(0.15);
  const set = (s: number, f: number) => {
    for (let j = 0; j < GENES_PER_SET; j++) { const k = s * GENES_PER_SET + j; m[k] = 0.15 + level[k] * f * prog; }
  };
  if (g === 0) set(0, 1);
  else if (g === 1) set(1, 1);
  else {
    set(2, Math.pow(1 - t, 1.5));
    set(3, Math.exp(-(((t - 0.5) / 0.2) ** 2)));
    set(4, 1 / (1 + Math.exp(-(t - 0.7) / 0.07)));
  }
  for (let j = 0; j < GENES_PER_SET; j++) { const k = 5 * GENES_PER_SET + j; m[k] = level[k]; }
  return m;
}

export function makeCells(seed = 2026): CellData {
  const r = rng(seed);
  const level: number[] = [];
  const size: number[] = [];
  for (let k = 0; k < N_GENES; k++) {
    level.push(4 + 16 * r.unif());          // expression level when "on": 4–20 counts
    size.push(3 + 7 * r.unif());            // NB size 3–10 (dispersion 0.1–0.33)
  }
  const counts: Float64Array[] = [], label: number[] = [], t: number[] = [];
  const add = (g: number, tt: number) => {
    const prog = Math.exp(0.2 * r.norm());  // cell-to-cell strength of the programme
    const m = trueMean(level, g, tt, prog);
    const x = new Float64Array(N_GENES);
    for (let k = 0; k < N_GENES; k++) x[k] = rnb(m[k], size[k], r.unif);
    counts.push(x);
    t.push(g === 2 ? tt : NaN);
    label.push(g === 2 ? (tt < 1 / 3 ? 2 : tt < 2 / 3 ? 3 : 4) : g);
  };
  for (let i = 0; i < 350; i++) add(0, NaN);
  for (let i = 0; i < 350; i++) add(1, NaN);
  for (let i = 0; i < 800; i++) add(2, r.unif());
  return { counts, label, t, size };
}
