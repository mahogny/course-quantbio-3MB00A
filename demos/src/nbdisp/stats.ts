// Poisson and negative-binomial pmfs via log-gamma, plus samplers.
// The NB is parameterised by its mean mu and "size" r (R's dnbinom size):
//   Var = mu + mu^2 / r.   r = Infinity is the Poisson.
// Each unit's dispersion convention maps onto r (see main.ts).

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log Gamma(x) for x > 0 (Lanczos, g = 7; reflection below 0.5). */
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function poisPmf(k: number, mu: number): number {
  return Math.exp(k * Math.log(mu) - mu - lgamma(k + 1));
}

export function nbPmf(k: number, mu: number, r: number): number {
  if (!Number.isFinite(r)) return poisPmf(k, mu);
  const lp = lgamma(k + r) - lgamma(r) - lgamma(k + 1)
    + r * Math.log(r / (r + mu)) + k * Math.log(mu / (r + mu));
  return Math.exp(lp);
}

export function nbVar(mu: number, r: number): number {
  return Number.isFinite(r) ? mu + mu * mu / r : mu;
}

/** Smallest K with P(X <= K) >= q, scanning up to kmax. */
export function quantile(pmf: (k: number) => number, q: number, kmax: number): number {
  let c = 0;
  for (let k = 0; k <= kmax; k++) { c += pmf(k); if (c >= q) return k; }
  return kmax;
}

type U = () => number;

function normal(unif: U): number {
  const u = 1 - unif(), v = unif();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape a, scale 1), Marsaglia–Tsang. */
export function rgamma(a: number, unif: U): number {
  if (a < 1) return rgamma(a + 1, unif) * Math.pow(unif(), 1 / a);
  const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(unif); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = unif();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Poisson(lambda) by multiplying uniforms, in chunks so exp(-lambda) never underflows. */
export function rpois(lambda: number, unif: U): number {
  let k = 0;
  while (lambda > 0) {
    const l = Math.min(lambda, 30);
    lambda -= l;
    const L = Math.exp(-l);
    let p = unif();
    while (p > L) { k++; p *= unif(); }
  }
  return k;
}

/** NB(mu, size r) as a Gamma–Poisson mixture: lambda ~ Gamma(r, mu/r), X ~ Poisson(lambda). */
export function rnb(mu: number, r: number, unif: U): number {
  if (!Number.isFinite(r)) return rpois(mu, unif);
  return rpois(rgamma(r, unif) * mu / r, unif);
}
