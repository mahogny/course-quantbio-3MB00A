// The maths of a 2-state HMM over DNA bases: simulate, forward (scaled), backward,
// posterior, Viterbi (in logs). No DOM, so node tests can import it.
// States: 0 = H ("GC-rich"), 1 = L ("normal"). Symbols: 0..3 = A, C, G, T.

export const BASES = ["A", "C", "G", "T"];
export const STATES = ["H", "L"];

export interface Model {
  pi: number[];      // initial distribution, length 2
  A: number[][];     // 2x2 transition matrix, A[i][j] = P(z_{t+1}=j | z_t=i)
  B: number[][];     // 2x4 emission matrix,   B[i][k] = P(x_t=k | z_t=i)
}

/** Emission row for a state with GC content g: (A, C, G, T) = ((1-g)/2, g/2, g/2, (1-g)/2). */
export const gcRow = (g: number): number[] => [(1 - g) / 2, g / 2, g / 2, (1 - g) / 2];

/** Model from the four slider values (stay in H, stay in L, GC in H, GC in L) and pi_H. */
export function makeModel(stayH: number, stayL: number, gcH: number, gcL: number, piH = 0.5): Model {
  return {
    pi: [piH, 1 - piH],
    A: [[stayH, 1 - stayH], [1 - stayL, stayL]],
    B: [gcRow(gcH), gcRow(gcL)],
  };
}

/** Draw an index from a probability row with one uniform number (inverse CDF). */
function pick(row: number[], u: number): number {
  let c = 0;
  for (let k = 0; k < row.length - 1; k++) { c += row[k]; if (u < c) return k; }
  return row.length - 1;
}

/**
 * Simulate T steps of the generative story. `us` holds 2T uniforms: us[2t] chooses the
 * state z_t, us[2t+1] the base x_t. Re-using the same uniforms with new parameters gives
 * a "same seed" sequence, so slider changes stay comparable.
 */
export function simulate(m: Model, us: number[]): { z: number[]; x: number[] } {
  const T = us.length >> 1;
  const z: number[] = [], x: number[] = [];
  for (let t = 0; t < T; t++) {
    const row = t === 0 ? m.pi : m.A[z[t - 1]];
    z.push(pick(row, us[2 * t]));
    x.push(pick(m.B[z[t]], us[2 * t + 1]));
  }
  return { z, x };
}

/** The joint probability P(x, z) of one path: pi, then alternate emit and move. */
export function jointProb(m: Model, x: number[], z: number[]): number {
  let p = m.pi[z[0]] * m.B[z[0]][x[0]];
  for (let t = 1; t < x.length; t++) p *= m.A[z[t - 1]][z[t]] * m.B[z[t]][x[t]];
  return p;
}

/** log P(x, z) (natural log), safe for long sequences. */
export function logJoint(m: Model, x: number[], z: number[]): number {
  let s = Math.log(m.pi[z[0]]) + Math.log(m.B[z[0]][x[0]]);
  for (let t = 1; t < x.length; t++) s += Math.log(m.A[z[t - 1]][z[t]]) + Math.log(m.B[z[t]][x[t]]);
  return s;
}

/** Scaled forward-backward. Returns log P(x) and the posterior P(z_t = H | x) per position. */
export function forwardBackward(m: Model, x: number[]): { logLik: number; postH: number[] } {
  const T = x.length;
  if (T === 0) return { logLik: 0, postH: [] };
  const al: number[][] = [], c: number[] = [];
  for (let t = 0; t < T; t++) {
    const a = [0, 1].map(j => (t === 0 ? m.pi[j]
      : al[t - 1][0] * m.A[0][j] + al[t - 1][1] * m.A[1][j]) * m.B[j][x[t]]);
    const s = a[0] + a[1];
    c.push(s);
    al.push([a[0] / s, a[1] / s]);
  }
  const be: number[][] = new Array(T);
  be[T - 1] = [1, 1];
  for (let t = T - 2; t >= 0; t--) {
    be[t] = [0, 1].map(i => (m.A[i][0] * m.B[0][x[t + 1]] * be[t + 1][0]
      + m.A[i][1] * m.B[1][x[t + 1]] * be[t + 1][1]) / c[t + 1]);
  }
  const postH = al.map((a, t) => {
    const h = a[0] * be[t][0], l = a[1] * be[t][1];
    return h / (h + l);
  });
  return { logLik: c.reduce((s, v) => s + Math.log(v), 0), postH };
}

/** Viterbi in log space: the single most likely hidden path. */
export function viterbi(m: Model, x: number[]): number[] {
  const T = x.length;
  if (T === 0) return [];
  const L = (v: number) => Math.log(v);
  let d = [0, 1].map(j => L(m.pi[j]) + L(m.B[j][x[0]]));
  const back: number[][] = [];
  for (let t = 1; t < T; t++) {
    const bp: number[] = [], nd: number[] = [];
    for (let j = 0; j < 2; j++) {
      const s0 = d[0] + L(m.A[0][j]), s1 = d[1] + L(m.A[1][j]);
      bp.push(s1 > s0 ? 1 : 0);
      nd.push(Math.max(s0, s1) + L(m.B[j][x[t]]));
    }
    back.push(bp);
    d = nd;
  }
  const z = new Array<number>(T);
  z[T - 1] = d[1] > d[0] ? 1 : 0;
  for (let t = T - 1; t > 0; t--) z[t - 1] = back[t - 1][z[t]];
  return z;
}

/** Fraction of positions where two state paths agree. */
export function agreement(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return NaN;
  let k = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) k++;
  return k / n;
}
