// Pure maths for the Beta-binomial demo (no DOM), so it can be tested with node.

/** log Gamma(x) for x > 0 (Lanczos, g = 7, n = 9; ~15 significant digits). */
export function lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let s = c[0];
  for (let i = 1; i < 9; i++) s += c[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

/** log of the Beta function B(a, b). */
export function lbeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** Beta(a, b) density at p. */
export function betaPdf(p: number, a: number, b: number): number {
  if (p < 0 || p > 1) return 0;
  if (p === 0) return a < 1 ? Infinity : a === 1 ? Math.exp(-lbeta(a, b)) : 0;
  if (p === 1) return b < 1 ? Infinity : b === 1 ? Math.exp(-lbeta(a, b)) : 0;
  return Math.exp((a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p) - lbeta(a, b));
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

/** Beta(a, b) cumulative distribution P(X <= x) (regularised incomplete beta). */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lf = a * Math.log(x) + b * Math.log(1 - x) - lbeta(a, b);
  if (x < (a + 1) / (a + b + 2)) return Math.exp(lf) * betacf(x, a, b) / a;
  return 1 - Math.exp(lf) * betacf(1 - x, b, a) / b;
}

/** Beta(a, b) quantile: the x with P(X <= x) = q, by bisection. */
export function betaQuantile(q: number, a: number, b: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < q) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Frequentist estimate k/n with the usual (Wald) 95% interval p ± 1.96·SE, clipped to [0, 1]. */
export function waldCI(k: number, n: number): { est: number; lo: number; hi: number } | null {
  if (n <= 0) return null;
  const p = k / n, se = Math.sqrt(p * (1 - p) / n);
  return { est: p, lo: Math.max(0, p - 1.96 * se), hi: Math.min(1, p + 1.96 * se) };
}

/** Equal-tailed 95% credible interval of the flat-prior posterior Beta(k + 1, n - k + 1). */
export function flatCrI(k: number, n: number): { lo: number; hi: number } {
  return { lo: betaQuantile(0.025, k + 1, n - k + 1), hi: betaQuantile(0.975, k + 1, n - k + 1) };
}

/** Binomial probability P(K = k) for K ~ Binomial(n, p). */
export function binomPmf(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Draw K ~ Binomial(n, p) from n uniforms (n is small here). */
export function rbinom(n: number, p: number, unif: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (unif() < p) k++;
  return k;
}

/**
 * Long-run share of intervals that contain p, when the experiment (n cells, true rate p)
 * is repeated forever: the sum of P(K = k) over the k whose interval contains p.
 */
export function coverage(n: number, p: number, iv: (k: number) => { lo: number; hi: number }): number {
  let s = 0;
  for (let k = 0; k <= n; k++) {
    const c = iv(k);
    if (c.lo <= p && p <= c.hi) s += binomPmf(k, n, p);
  }
  return s;
}
