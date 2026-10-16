// Fixed-seed datasets for the pca2d demo.
import { rng } from "../lib/ui";
import type { Pt } from "./pca";

/** The lecture's toy data (GENE_A, GENE_B) for samples s1..s5. */
export const LECTURE: Pt[] = [[1, 5], [3, 3], [4, 6], [5, 7], [7, 9]];

function rot(p: Pt, deg: number): Pt {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1]];
}

/** 30 samples in a tilted elongated cloud around (4, 6), like a bigger lecture dataset. */
export function cloud30(): Pt[] {
  const r = rng(7);
  const out: Pt[] = [];
  for (let i = 0; i < 30; i++) {
    const p = rot([2.0 * r.norm(), 0.7 * r.norm()], 35);
    out.push([4 + p[0], 6 + p[1]]);
  }
  return out;
}

/** Pitfall: metabolite A in large raw intensities (SD ~100), B a ratio (SD ~1.4), correlated. */
export function units(): Pt[] {
  const r = rng(11);
  const out: Pt[] = [];
  for (let i = 0; i < 40; i++) {
    const z1 = r.norm(), z2 = r.norm();
    out.push([100 * z1, 1.4 * (0.75 * z1 + 0.66 * z2)]);
  }
  return out;
}

/** Pitfall: a cloud of 30 samples; the outlier is stored separately (draggable). */
export function outlierCloud(): Pt[] {
  const r = rng(5);
  const out: Pt[] = [];
  for (let i = 0; i < 30; i++) out.push(rot([1.1 * r.norm(), 0.45 * r.norm()], 20));
  return out;
}
export const OUTLIER_START: Pt = [-1.5, 6];

/** Pitfall: two groups, long along a shared direction, separated only across it. */
export function groups(): { pts: Pt[]; grp: number[] } {
  const r = rng(3);
  const pts: Pt[] = [], grp: number[] = [];
  for (let g = 0; g < 2; g++) {
    for (let i = 0; i < 20; i++) {
      pts.push(rot([2.0 * r.norm(), 0.25 * r.norm() + (g === 0 ? 0.75 : -0.75)], 25));
      grp.push(g);
    }
  }
  return { pts, grp };
}
