// Bayes' rule on a few discrete hypotheses ("grid" posterior).
// posterior_i = prior_i * like_i / sum_j prior_j * like_j
import { lgamma } from "../nbdisp/stats";

/** Binomial probability of k positives out of n when each is positive with chance p (as R's dbinom). */
export function binomLike(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  const lc = lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  return Math.exp(lc + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Probability of all observed counts (independent Poisson draws with the same rate), as prod(dpois(counts, rate)). */
export function poissonLike(counts: number[], rate: number): number {
  if (rate <= 0) return counts.every(c => c === 0) ? 1 : 0;
  let s = 0;
  for (const c of counts) s += c * Math.log(rate) - rate - lgamma(c + 1);
  return Math.exp(s);
}

export interface Update { prod: number[]; total: number; post: number[] | null }

/** Multiply prior by likelihood and renormalise; post is null when every product is 0. */
export function bayesUpdate(prior: number[], like: number[]): Update {
  const prod = prior.map((p, i) => p * like[i]);
  const total = prod.reduce((a, b) => a + b, 0);
  return { prod, total, post: total > 0 ? prod.map(v => v / total) : null };
}

/** Scale non-negative weights to sum 1 (equal weights if all are 0). */
export function normalise(w: number[]): number[] {
  const s = w.reduce((a, b) => a + Math.max(0, b), 0);
  return s > 0 ? w.map(v => Math.max(0, v) / s) : w.map(() => 1 / w.length);
}

/**
 * Set prior bar i to v (0..1) and rescale the other bars so that all still sum to 1,
 * keeping their proportions (equal shares if they were all 0).
 */
export function setOne(prior: number[], i: number, v: number): number[] {
  v = Math.min(1, Math.max(0, v));
  const rest = prior.reduce((a, b, j) => (j === i ? a : a + b), 0);
  const m = prior.length - 1;
  return prior.map((p, j) => (j === i ? v : rest > 0 ? p * (1 - v) / rest : (1 - v) / m));
}

/**
 * Plain decimal with 3 significant digits and no exponent: 0.5, 0.333, 0.0273, 1, 0.0000123.
 * Values below 1e-9 print as "≈0".
 */
export function fmt(v: number): string {
  if (v === 0) return "0";
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a < 1e-9) return "≈0";
  const d = Math.max(0, Math.min(12, 2 - Math.floor(Math.log10(a))));
  let s = v.toFixed(d);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}
