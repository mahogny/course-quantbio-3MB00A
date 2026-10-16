// Fixed-seed toy "PC-space" datasets for the umaplive demo (20 dimensions, 300 cells).
import { rng } from "../lib/ui";

export const DIM = 20;

export interface Dataset {
  key: "clusters" | "trajectory" | "noise";
  label: string;
  X: number[][];
  group: Int32Array | null;     // true group (clusters preset)
  time: Float64Array | null;    // pseudotime 0..1 (trajectory preset)
  legend: string[];             // one line per group
}

type R = ReturnType<typeof rng>;

/** m orthonormal random directions in R^D (Gram-Schmidt). */
function ortho(r: R, D: number, m: number): number[][] {
  const out: number[][] = [];
  while (out.length < m) {
    let v = Array.from({ length: D }, () => r.norm());
    for (const u of out) { const d = u.reduce((s, x, p) => s + x * v[p], 0); v = v.map((x, p) => x - d * u[p]); }
    const nn = Math.hypot(...v);
    out.push(v.map(x => x / nn));
  }
  return out;
}

const comb = (coef: number[], basis: number[][]) =>
  basis[0].map((_, p) => coef.reduce((s, c, q) => s + c * basis[q][p], 0));

/**
 * Four groups of very different size and spread. A and B are close in high-D, C is
 * further away, D is far from all three.
 */
export function clusters(): Dataset {
  const r = rng(2026);
  const U = ortho(r, DIM, 3);
  const cA = comb([0, 0, 0], U), cB = comb([9, 0, 0], U), cC = comb([4.5, 17.4, 0], U);
  const cD = comb([4.5, 5.8, 44], U);
  const spec: [number[], number, number][] = [[cA, 150, 1.0], [cB, 30, 0.3], [cC, 80, 0.6], [cD, 40, 1.5]];
  const X: number[][] = [], g: number[] = [];
  spec.forEach(([c, size, sd], k) => {
    for (let i = 0; i < size; i++) { X.push(c.map(v => v + sd * r.norm())); g.push(k); }
  });
  return {
    key: "clusters", label: "4 clusters", X, group: Int32Array.from(g), time: null,
    legend: ["A: 150 cells, wide", "B: 30 cells, tight, next to A", "C: 80 cells, medium", "D: 40 cells, wide, far away"],
  };
}

/** A curved differentiation path that splits into two branches; coloured by pseudotime. */
export function trajectory(): Dataset {
  const r = rng(77);
  const U = ortho(r, DIM, 5);
  const n = 300, split = 0.4;
  const X: number[][] = [], t: number[] = [], g: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = r.unif();
    const th = 1.6 * Math.PI * s;
    const lat = [5 * Math.cos(th), 5 * Math.sin(th), 7 * s, 0, 0];
    const br = s > split ? (r.unif() < 0.5 ? 1 : 2) : 0;
    if (br === 1) lat[3] += 9 * (s - split);
    if (br === 2) lat[4] += 9 * (s - split);
    const x = comb(lat, U).map(v => v + 0.25 * r.norm());
    X.push(x); t.push(s); g.push(br);
  }
  return { key: "trajectory", label: "Branching path", X, group: Int32Array.from(g), time: Float64Array.from(t), legend: [] };
}

/** One round Gaussian blob: no groups, no path. */
export function noise(): Dataset {
  const r = rng(5);
  const X: number[][] = [];
  for (let i = 0; i < 300; i++) X.push(Array.from({ length: DIM }, () => r.norm()));
  return { key: "noise", label: "Pure noise", X, group: null, time: null, legend: ["one round Gaussian blob"] };
}

export const DATASETS = { clusters, trajectory, noise };
