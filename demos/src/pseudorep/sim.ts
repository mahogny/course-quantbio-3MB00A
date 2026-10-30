// Pseudoreplication simulation. Two groups (control, treated), P patients per group,
// M measurements ("cells") per patient:
//   value = treatment effect (treated only) + patient effect + measurement noise,
//   patient effect ~ N(0, ICC),  measurement noise ~ N(0, 1 − ICC),
// so the total variance of one measurement is 1 and ICC = share of it that is between patients.
// Two analyses of the same data:
//   naive      — Student t-test on all 2PM values, df = 2PM − 2 (pretends every cell is a sample);
//   perPatient — Student t-test on the 2P patient means, df = 2P − 2.
// With equal cells per patient the per-patient test is the classical nested-ANOVA test of
// treatment, which is also what lmer (REML, Satterthwaite df) gives whenever its estimate of
// the between-patient variance is above 0; otherwise lmer is somewhat more liberal.
import { rng } from "../lib/ui";
import { lgamma } from "../nbdisp/stats";

export interface Params { icc: number; P: number; M: number; effect: number; }

/** One study: values[g][p][m], g = 0 control, 1 treated. */
export type Study = number[][][];

export function simulateStudy(r: ReturnType<typeof rng>, p: Params): Study {
  const sb = Math.sqrt(p.icc), sw = Math.sqrt(1 - p.icc);
  const out: Study = [];
  for (let g = 0; g < 2; g++) {
    const grp: number[][] = [];
    for (let i = 0; i < p.P; i++) {
      const mu = g * p.effect + sb * r.norm();
      const cells: number[] = new Array(p.M);
      for (let j = 0; j < p.M; j++) cells[j] = mu + sw * r.norm();
      grp.push(cells);
    }
    out.push(grp);
  }
  return out;
}

/** Student (pooled-variance) two-sample t-test. Returns t, df, two-sided p. */
export function tTest(a: number[], b: number[]): { t: number; df: number; p: number } {
  const n1 = a.length, n2 = b.length, df = n1 + n2 - 2;
  const m1 = mean(a), m2 = mean(b);
  let ss = 0;
  for (const v of a) ss += (v - m1) ** 2;
  for (const v of b) ss += (v - m2) ** 2;
  const se = Math.sqrt(ss / df * (1 / n1 + 1 / n2));
  const t = se > 0 ? (m2 - m1) / se : 0;
  return { t, df, p: tPvalue(t, df) };
}

export function mean(a: number[]): number { let s = 0; for (const v of a) s += v; return s / a.length; }

export interface Result { naive: number; perPatient: number; }

/** p-values of both analyses for one study. */
export function analyse(s: Study): Result {
  const flat = s.map(g => g.flat());
  const means = s.map(g => g.map(mean));
  return { naive: tTest(flat[0], flat[1]).p, perPatient: tTest(means[0], means[1]).p };
}

export interface Summary {
  example: Study; exampleP: Result;   // study #1, drawn in the picture
  nStudies: number;
  naive: number; perPatient: number;  // fraction of studies with p < alpha
}

/** Simulate nStudies studies with a fixed seed; study #1 is returned as the example. */
export function run(p: Params, nStudies: number, seed: number, alpha = 0.05): Summary {
  const r = rng(seed * 104729 + 7);
  let nv = 0, pp = 0;
  let example: Study = [], exampleP: Result = { naive: 1, perPatient: 1 };
  for (let k = 0; k < nStudies; k++) {
    const s = simulateStudy(r, p);
    const res = analyse(s);
    if (k === 0) { example = s; exampleP = res; }
    if (res.naive < alpha) nv++;
    if (res.perPatient < alpha) pp++;
  }
  return { example, exampleP, nStudies, naive: nv / nStudies, perPatient: pp / nStudies };
}

/** Effective number of independent samples for all 2PM cells: 2PM / (1 + (M − 1)·ICC). */
export function effectiveN(p: Params): number {
  return 2 * p.P * p.M / (1 + (p.M - 1) * p.icc);
}

// ---------------- Student t distribution ----------------

/** Two-sided p-value P(|T| ≥ |t|) for T ~ t(df): I_x(df/2, 1/2) with x = df / (df + t²). */
export function tPvalue(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

/** Regularized incomplete beta I_x(a, b) (continued fraction, Numerical Recipes betai). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
  return 1 - bt * betacf(1 - x, b, a) / b;
}

function betacf(x: number, a: number, b: number): number {
  const TINY = 1e-300, EPS = 1e-14;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
