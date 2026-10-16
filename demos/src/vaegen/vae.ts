// The tiny count VAE used by the vaegen demo: forward passes only (training is in train.ts).
//
// Encoder: log1p(counts) (G) → tanh hidden (H) → mean (2) and log-variance (2) of a 2D normal.
// Decoder: z (2) → tanh hidden (H) → log of the expected count of every gene (G).
// Likelihood: negative binomial per gene, mean from the decoder, size exp(logSize[g]) learned.
// Weight matrices are flat row-major arrays: W[o * nIn + i].

export interface VaeWeights {
  G: number; H: number; Z: number;
  W1: number[]; b1: number[];      // encoder hidden: H × G
  Wm: number[]; bm: number[];      // encoder mean:   Z × H
  Wv: number[]; bv: number[];      // encoder logvar: Z × H
  W2: number[]; b2: number[];      // decoder hidden: H × Z
  W3: number[]; b3: number[];      // decoder output: G × H
  logSize: number[];               // NB log size per gene
}

export function dense(W: ArrayLike<number>, b: ArrayLike<number>, x: ArrayLike<number>, nOut: number, act?: (v: number) => number): number[] {
  const nIn = x.length, y = new Array<number>(nOut);
  for (let o = 0; o < nOut; o++) {
    let s = b[o];
    for (let i = 0; i < nIn; i++) s += W[o * nIn + i] * x[i];
    y[o] = act ? act(s) : s;
  }
  return y;
}

/** Encoder: raw counts → mean and standard deviation of the latent cloud. */
export function encode(w: VaeWeights, counts: ArrayLike<number>): { mu: number[]; sd: number[] } {
  const x = Array.from(counts, v => Math.log1p(v));
  const h = dense(w.W1, w.b1, x, w.H, Math.tanh);
  const mu = dense(w.Wm, w.bm, h, w.Z);
  const lv = dense(w.Wv, w.bv, h, w.Z);
  return { mu, sd: lv.map(v => Math.exp(0.5 * v)) };
}

/** Decoder: latent point → expected count of every gene. */
export function decode(w: VaeWeights, z: ArrayLike<number>): number[] {
  const h = dense(w.W2, w.b2, z, w.H, Math.tanh);
  return dense(w.W3, w.b3, h, w.G).map(v => Math.exp(Math.min(v, 8)));
}
