// Pure continuous-time Markov-chain maths for the "ctmcwalkers" demo (no DOM), so it
// can be unit-tested. Convention (as in the lectures): R[i][j] (i != j) is the rate
// from i to j; the rate matrix Q has these off the diagonal and q_ii = -(row sum), so
// every row of Q sums to 0. Distributions are row vectors and dx/dt = x Q.
import { Mat, stationary as stationaryP } from "../markov/chain";

export type { Mat };

export interface CChain {
  label: string;
  states: string[];
  R: Mat;            // off-diagonal rates; the diagonal is ignored
  start?: number;    // start state index
  unit?: string;     // rate unit, e.g. "/min" (time unit = "min")
  speed?: number;    // default speed, time units per second
  view?: number;     // initial width of the time axis
}

/** Total leaving rate q_i = sum of the rates out of state i. */
export function leaveRate(R: Mat, i: number): number {
  let q = 0;
  for (let j = 0; j < R.length; j++) if (j !== i) q += Math.max(0, R[i][j]);
  return q;
}

/** Rate matrix Q: off-diagonals are the rates, each diagonal entry is minus its row sum. */
export function rateMatrix(R: Mat): Mat {
  const n = R.length;
  return R.map((row, i) => row.map((v, j) => (i === j ? -leaveRate(R, i) : Math.max(0, v))));
}

/** (x Q)_j = sum_i x_i q_ij. */
export function xQ(x: number[], Q: Mat): number[] {
  const n = x.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) y[j] += x[i] * Q[i][j];
  return y;
}

/** One classical Runge-Kutta (RK4) step of dx/dt = x Q with step h. */
export function rk4Step(x: number[], Q: Mat, h: number): number[] {
  const add = (a: number[], b: number[], s: number) => a.map((v, k) => v + s * b[k]);
  const k1 = xQ(x, Q);
  const k2 = xQ(add(x, k1, h / 2), Q);
  const k3 = xQ(add(x, k2, h / 2), Q);
  const k4 = xQ(add(x, k3, h), Q);
  return x.map((v, k) => v + (h / 6) * (k1[k] + 2 * k2[k] + 2 * k3[k] + k4[k]));
}

/** Largest leaving rate (sets the step size). */
export function maxRate(Q: Mat): number {
  return Math.max(0, ...Q.map((r, i) => -r[i]));
}

/** Advance x(t) to x(t + dt) by RK4 steps of at most 0.02 / maxRate. */
export function advance(x: number[], Q: Mat, dt: number): number[] {
  if (dt <= 0) return x.slice();
  const m = maxRate(Q);
  if (m === 0) return x.slice();
  const steps = Math.max(1, Math.ceil(dt / (0.02 / m)));
  const h = dt / steps;
  let y = x;
  for (let s = 0; s < steps; s++) y = rk4Step(y, Q, h);
  return y;
}

/**
 * Stationary distribution: pi Q = 0 with sum(pi) = 1. Same pi as the discrete chain
 * P = I + Q / lambda (lambda >= every leaving rate), so reuse the markov solver.
 * Returns null when it is not unique.
 */
export function stationary(Q: Mat): number[] | null {
  const n = Q.length;
  const lam = maxRate(Q) * 1.5;
  if (lam === 0) return n === 1 ? [1] : null;
  const P = Q.map((r, i) => r.map((v, j) => (i === j ? 1 : 0) + v / lam));
  return stationaryP(P);
}

/** Exponential waiting time with the given rate, from a uniform u in [0,1). */
export function expSample(rate: number, u: number): number {
  return rate > 0 ? -Math.log(1 - u) / rate : Infinity;
}

/** Where to jump from i: state j with probability R[i][j] / q_i (the jump chain). */
export function pickJump(R: Mat, i: number, u: number): number {
  const q = leaveRate(R, i);
  let acc = 0, last = i;
  for (let j = 0; j < R.length; j++) {
    if (j === i || R[i][j] <= 0) continue;
    acc += R[i][j] / q;
    last = j;
    if (u < acc) return j;
  }
  return last;
}

/** Built-in chains, selectable by key in data-presets. */
export const PRESETS: Record<string, CChain> = {
  // Lecture: promoter ON -> OFF at a = 0.5/min, OFF -> ON at b = 0.25/min; pi = (1/3, 2/3)
  telegraph: { label: "Promoter ON/OFF", states: ["ON", "OFF"], R: [[0, 0.5], [0.25, 0]], unit: "/min", speed: 1, view: 10 },
  // Exercise: a = 0.4, b = 0.1; pi = (0.2, 0.8)
  telegraph2: { label: "Promoter (exercise)", states: ["ON", "OFF"], R: [[0, 0.4], [0.1, 0]], unit: "/min", speed: 2, view: 20 },
  // Same pi = (1/3, 2/3) as "telegraph", 4x faster / 5x slower
  fast: { label: "Fast switching", states: ["ON", "OFF"], R: [[0, 2], [1, 0]], unit: "/min", speed: 1, view: 10 },
  slow: { label: "Slow switching", states: ["ON", "OFF"], R: [[0, 0.1], [0.05, 0]], unit: "/min", speed: 1, view: 10 },
  // Cell states in a line: pi = (1, 2, 4) / 7
  cell3: {
    label: "Cell states", states: ["stem", "prog", "diff"],
    R: [[0, 0.4, 0], [0.2, 0, 0.2], [0, 0.1, 0]], unit: "/day", speed: 2, view: 20,
  },
  // An absorbing state: once dead, always dead
  absorbing: {
    label: "Absorbing", states: ["live", "sick", "dead"],
    R: [[0, 0.2, 0], [0.3, 0, 0.1], [0, 0, 0]], unit: "/day", speed: 2, view: 50,
  },
  // Jukes-Cantor: every substitution at rate 1/3, so time is in expected substitutions per site
  jc: {
    label: "Jukes–Cantor", states: ["A", "C", "G", "T"],
    R: [[0, 1 / 3, 1 / 3, 1 / 3], [1 / 3, 0, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 0, 1 / 3], [1 / 3, 1 / 3, 1 / 3, 0]],
    unit: "", speed: 0.5, view: 5,
  },
};
