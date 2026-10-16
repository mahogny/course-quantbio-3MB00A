// Pure maths for the MCMC playground (no DOM), so it can be tested with node.
// Target: the posterior of intercept a and slope b in the age-expression regression
//   y_i = a + b * (age_i - 50) / 10 + noise,  noise ~ Normal(0, sigma^2), sigma known,
// with flat priors. So a = expression at age 50, b = change per 10 years.
// With these choices the posterior is exactly a 2D Normal, which lets the demo draw the
// true contours and marginals next to what the sampler finds.

export const AGES = [23, 29, 34, 38, 44, 47, 52, 56, 61, 66, 71, 78];
export const EXPR = [4.4, 5.8, 5.0, 5.7, 7.1, 6.7, 7.7, 6.2, 6.0, 7.4, 6.8, 6.0];
export const SIGMA = 1; // noise scale, treated as known so the posterior is 2D

export interface Gauss2 { ma: number; mb: number; saa: number; sbb: number; sab: number; }

/** Exact posterior (flat priors, known sigma): mean = least squares, cov = sigma^2 (X'X)^-1. */
export function exactPosterior(ages = AGES, y = EXPR, sigma = SIGMA): Gauss2 {
  const x = ages.map(t => (t - 50) / 10);
  const n = x.length;
  const sx = x.reduce((s, v) => s + v, 0), sxx = x.reduce((s, v) => s + v * v, 0);
  const sy = y.reduce((s, v) => s + v, 0), sxy = x.reduce((s, v, i) => s + v * y[i], 0);
  const det = n * sxx - sx * sx;
  const mb = (n * sxy - sx * sy) / det, ma = (sy - mb * sx) / n;
  const s2 = sigma * sigma;
  return { ma, mb, saa: s2 * sxx / det, sbb: s2 * n / det, sab: -s2 * sx / det };
}

/** Log posterior up to a constant: -sum of squared residuals / (2 sigma^2). */
export function makeLogPost(ages = AGES, y = EXPR, sigma = SIGMA): (a: number, b: number) => number {
  const x = ages.map(t => (t - 50) / 10);
  return (a, b) => {
    let ss = 0;
    for (let i = 0; i < x.length; i++) { const r = y[i] - a - b * x[i]; ss += r * r; }
    return -ss / (2 * sigma * sigma);
  };
}

export interface Chain {
  a: number[]; b: number[];      // the chain so far (index 0 = start)
  lp: number;                    // log posterior at the current point
  accepted: number; proposed: number;
  lastProp: [number, number] | null; lastAcc: boolean;
}

export function newChain(a0: number, b0: number, logPost: (a: number, b: number) => number): Chain {
  return { a: [a0], b: [b0], lp: logPost(a0, b0), accepted: 0, proposed: 0, lastProp: null, lastAcc: false };
}

/**
 * One random-walk Metropolis step: propose current + step * Normal(0, 1) in each coordinate;
 * accept with probability min(1, post(new) / post(old)); otherwise stay (repeat the old point).
 */
export function metropolisStep(c: Chain, step: number, logPost: (a: number, b: number) => number,
  r: { unif: () => number; norm: () => number }): void {
  const i = c.a.length - 1;
  const pa = c.a[i] + step * r.norm(), pb = c.b[i] + step * r.norm();
  const lpNew = logPost(pa, pb);
  const acc = Math.log(r.unif()) < lpNew - c.lp;
  c.proposed++;
  c.lastProp = [pa, pb];
  c.lastAcc = acc;
  if (acc) { c.accepted++; c.lp = lpNew; c.a.push(pa); c.b.push(pb); }
  else { c.a.push(c.a[i]); c.b.push(c.b[i]); }
}

/**
 * Split R-hat (as in Stan): split every chain in two halves and compare the variance
 * between the halves with the variance within them. ~1 when all agree. NaN if too short.
 */
export function splitRhat(chains: number[][]): number {
  const halves: number[][] = [];
  for (const c of chains) {
    const h = Math.floor(c.length / 2);
    if (h < 5) return NaN;
    halves.push(c.slice(0, h), c.slice(c.length - h));
  }
  const m = halves.length, n = halves[0].length;
  const means = halves.map(h => h.reduce((s, v) => s + v, 0) / n);
  const grand = means.reduce((s, v) => s + v, 0) / m;
  const B = n / (m - 1) * means.reduce((s, v) => s + (v - grand) ** 2, 0);
  const W = halves.reduce((s, h, j) => s + h.reduce((t, v) => t + (v - means[j]) ** 2, 0) / (n - 1), 0) / m;
  if (W <= 0) return B > 0 ? Infinity : NaN;
  const varPlus = (n - 1) / n * W + B / n;
  return Math.sqrt(varPlus / W);
}
