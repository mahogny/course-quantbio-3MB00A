// Simulated UMI counts and the shifted log, for the pseudocount demo (no DOM, testable with node).
// 200 cells (100 T, 100 B) with different sequencing depths n (total UMIs per cell,
// median about 5,000) and 74 genes: 60 background genes (same mean in both types,
// 0.02 to 30 UMIs per cell at depth 5,000), 4 very high genes (150-400) and 10 cell-type
// markers (on in one type, 4-13 times lower in the other, at three expression levels).
// Negative-binomial counts, size 5, fixed seed.
import { rng } from "../lib/ui";

export type Kind = "bg" | "hi" | "mk";
export interface Gene { name: string; kind: Kind; mean: number }   // mean UMIs at depth 5,000
export interface Data {
  genes: Gene[];
  type: ("T" | "B")[];
  depth: number[];          // n: total UMIs per cell
  counts: number[][];       // counts[gene][cell]
}

export const REF_DEPTH = 5000;
export const SCALE = 10000;
// Seurat's scale factor: x / n * 10,000

function poisson(lambda: number, unif: () => number): number {
  let k = 0;
  while (lambda > 30) { k += poisson(30, unif); lambda -= 30; }   // sum of Poissons is Poisson
  const L = Math.exp(-lambda);
  let p = 1;
  for (;;) { p *= unif(); if (p <= L) return k; k++; }
}

function gamma(shape: number, r: ReturnType<typeof rng>): number {   // Marsaglia–Tsang, shape >= 1
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = r.norm(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r.unif();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// cell-type markers: [mean where on, mean where off, cell type where on]
export const MARKERS: [number, number, "T" | "B"][] = [
  [4, 0.3, "T"], [4, 0.3, "B"], [4, 0.3, "T"], [4, 0.3, "B"], [4, 0.3, "T"],
  [8, 2, "B"], [8, 2, "T"], [8, 2, "B"], [20, 5, "T"], [20, 5, "B"],
];

export function simulate(seed = 7): Data {
  const r = rng(seed);
  const nCell = 200, size = 5;
  const type = Array.from({ length: nCell }, (_, i) => (i < nCell / 2 ? "T" : "B") as "T" | "B");
  const depth = type.map(() => Math.round(REF_DEPTH * Math.exp(0.35 * r.norm())));
  const genes: Gene[] = [];
  for (let j = 0; j < 60; j++)
    genes.push({ name: "bg" + (j + 1), kind: "bg", mean: Math.exp(Math.log(0.02) + j / 59 * Math.log(30 / 0.02)) });
  [150, 200, 300, 400].forEach((m, j) => genes.push({ name: "hi" + (j + 1), kind: "hi", mean: m }));
  MARKERS.forEach(([on, off], j) => genes.push({ name: "mk" + (j + 1), kind: "mk", mean: (on + off) / 2 }));
  const counts = genes.map((g, j) => type.map((t, i) => {
    let m = g.mean;
    if (g.kind === "mk") { const [on, off, ty] = MARKERS[j - 64]; m = t === ty ? on : off; }
    const mu = m * depth[i] / REF_DEPTH;
    return poisson(mu * gamma(size, r) / size, r.unif);
  }));
  return { genes, type, depth, counts };
}

/** Values before the log: raw counts, or x / n * 10,000. */
export function values(d: Data, normalize: boolean): number[][] {
  return d.counts.map(row => row.map((x, i) => (normalize ? x / d.depth[i] * SCALE : x)));
}

/** The shifted log, log_base(v + c). */
export const tlog = (v: number, c: number, base: number): number => Math.log(v + c) / Math.log(base);

export function mean(v: number[]): number { return v.reduce((a, b) => a + b, 0) / v.length; }
export function variance(v: number[]): number {
  const m = mean(v);
  return v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1);
}

/** Per gene: mean before the log and variance after the log. */
export function meanVar(vals: number[][], c: number, base: number): { m: number; v: number }[] {
  return vals.map(row => ({ m: mean(row), v: variance(row.map(x => tlog(x, c, base))) }));
}

/** Indices of the k largest values. */
export function topK(v: number[], k: number): number[] {
  return v.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]).slice(0, k).map(p => p[1]);
}
