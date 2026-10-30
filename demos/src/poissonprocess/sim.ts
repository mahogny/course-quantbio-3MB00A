// Simulation for the poissonprocess demo: random events along a line (a genome in Mb, or time).
// Pure functions, no DOM, so the numbers can be checked in node.
//
// Random: the number of events is Poisson(rate * L); each event is placed uniformly on [0, L)
//   (the line is treated as a circle, so the last gap wraps round to the first event).
// Clumped: burst centres at rate / BURST, each burst has 1 + Poisson(BURST - 1) events spread
//   uniformly over a short stretch SPREAD / rate after the centre. Same mean rate, but window
//   counts have variance ≈ mean · E[M²] / E[M] = mean · 11/3 for windows much longer than a burst.
import { rng } from "../lib/ui";
import { rpois } from "../nbdisp/stats";

export const BURST = 3;      // mean events per burst
export const SPREAD = 0.3;   // burst length, in units of the mean gap 1 / rate

/** Sorted event positions on [0, L). */
export function simulate(rate: number, L: number, clumped: boolean, seed: number): Float64Array {
  const g = rng(seed * 7919 + 13);
  const pos: number[] = [];
  if (!clumped) {
    const n = rpois(rate * L, g.unif);
    for (let i = 0; i < n; i++) pos.push(g.unif() * L);
  } else {
    const nb = rpois(rate / BURST * L, g.unif), spread = SPREAD / rate;
    for (let b = 0; b < nb; b++) {
      const c = g.unif() * L, m = 1 + rpois(BURST - 1, g.unif);
      for (let j = 0; j < m; j++) pos.push((c + g.unif() * spread) % L);
    }
  }
  return Float64Array.from(pos).sort();
}

/** Events per window when [0, L) is cut into floor(L / w) windows of length w. */
export function windowCounts(pos: Float64Array, L: number, w: number): number[] {
  const n = Math.floor(L / w + 1e-9);
  const c = new Array<number>(n).fill(0);
  for (const p of pos) { const i = Math.floor(p / w); if (i < n) c[i]++; }
  return c;
}

/** Distances between neighbouring events (circular, so as many gaps as events). */
export function gaps(pos: Float64Array, L: number): number[] {
  const n = pos.length, out: number[] = [];
  for (let i = 1; i < n; i++) out.push(pos[i] - pos[i - 1]);
  if (n > 1) out.push(pos[0] + L - pos[n - 1]);
  return out;
}

export function meanVar(x: number[]): { mean: number; variance: number } {
  const n = x.length;
  if (n < 2) return { mean: n ? x[0] : NaN, variance: NaN };
  let s = 0;
  for (const v of x) s += v;
  const m = s / n;
  let ss = 0;
  for (const v of x) ss += (v - m) * (v - m);
  return { mean: m, variance: ss / (n - 1) };
}
