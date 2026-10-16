// Normal–normal partial pooling, as on the hierarchical-models slides:
//   raw group mean  ybar_i ~ N(mu_i, sigma2 / n_i),   mu_i ~ N(mu, tau2)
//   estimate        muhat_i = w_i ybar_i + (1 - w_i) muhat,
//   weight          w_i = (n_i / sigma2) / (n_i / sigma2 + 1 / tau2).
import { rng } from "../lib/ui";

export interface Data {
  n: number[];      // group sizes
  truth: number[];  // simulated true group means mu_i
  raw: number[];    // raw group means ybar_i (no pooling)
  grand: number;    // grand mean = mean of all measurements (complete pooling)
}

/** Simulate one data set. Same seed => same data. */
export function simulate(seed: number, n: number[], mu: number, tau2True: number, sigma2: number): Data {
  const r = rng(seed * 7919 + 13);
  const truth = n.map(() => mu + Math.sqrt(tau2True) * r.norm());
  const raw = n.map((ni, i) => truth[i] + Math.sqrt(sigma2 / ni) * r.norm());
  const N = n.reduce((a, b) => a + b, 0);
  const grand = n.reduce((a, ni, i) => a + ni * raw[i], 0) / N;
  return { n, truth, raw, grand };
}

/** Weight on the group's own mean. tau2 = 0 -> 0 (complete pooling), Infinity -> 1 (no pooling). */
export function weight(ni: number, sigma2: number, tau2: number): number {
  if (tau2 <= 0) return 0;
  if (!Number.isFinite(tau2)) return 1;
  const a = ni / sigma2;
  return a / (a + 1 / tau2);
}

export function estimates(d: Data, sigma2: number, tau2: number): number[] {
  return d.raw.map((y, i) => { const w = weight(d.n[i], sigma2, tau2); return w * y + (1 - w) * d.grand; });
}

/** Total squared error against the simulated truth. */
export function sse(est: number[], truth: number[]): number {
  return est.reduce((a, e, i) => a + (e - truth[i]) ** 2, 0);
}

/** Slider position (0..POS_MAX) <-> tau2. 0 = complete pooling, POS_MAX = no pooling,
 *  the middle is the true tau2, 10 steps per factor of 10. */
export const POS_MAX = 48;
export function posToTau2(pos: number, tau2True: number): number {
  if (pos <= 0) return 0;
  if (pos >= POS_MAX) return Infinity;
  return tau2True * Math.pow(10, (pos - POS_MAX / 2) / 10);
}
