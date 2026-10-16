// Offline training of the count VAE for the vaegen demo. NOT part of the browser bundle.
//
// Re-run from the repository root (needs `npm i` once; takes about a minute):
//   npx esbuild demos/src/vaegen/train.ts --bundle --platform=node --outfile=/tmp/vaegen-train.cjs
//   node /tmp/vaegen-train.cjs > demos/src/vaegen/weights.ts
// Progress and quality checks go to stderr; the weights module goes to stdout.
//
// Data: makeCells(2026) from data.ts (1500 simulated cells × 36 genes, NB counts).
// Model: see vae.ts. Encoder input log1p(counts); 32 tanh hidden units; latent dimension 2;
// decoder 2 → 32 tanh → 36 log-means; negative-binomial likelihood with a learned size per gene.
// Loss per cell = −log NB(counts | decoder(z)) + KL(encoder cloud ‖ standard normal),
// z drawn once per cell per step (the reparameterisation trick). Plain JS backprop + Adam,
// fixed seed (training noise comes from rng(7)), so the output is reproducible.
import { rng } from "../lib/ui";
import { lgamma } from "../nbdisp/stats";
import { makeCells, N_GENES, LABELS } from "./data";
import { encode, decode, type VaeWeights } from "./vae";

const G = N_GENES, H = 32, Z = 2;
const EPOCHS = 600, BATCH = 100, LR = 3e-3, WARMUP = 60;

// ---- parameter layout in one flat array ----
const shapes: [string, number][] = [
  ["W1", H * G], ["b1", H], ["Wm", Z * H], ["bm", Z], ["Wv", Z * H], ["bv", Z],
  ["W2", H * Z], ["b2", H], ["W3", G * H], ["b3", G], ["logSize", G],
];
const off: Record<string, number> = {};
let P = 0;
for (const [n, k] of shapes) { off[n] = P; P += k; }
const th = new Float64Array(P), gr = new Float64Array(P), m1 = new Float64Array(P), m2 = new Float64Array(P);

const R = rng(7);
function initDense(name: string, nOut: number, nIn: number): void {
  const s = Math.sqrt(1 / nIn);
  for (let i = 0; i < nOut * nIn; i++) th[off[name] + i] = s * R.norm();
}
initDense("W1", H, G); initDense("Wm", Z, H); initDense("Wv", Z, H);
initDense("W2", H, Z); initDense("W3", G, H);
for (let i = 0; i < Z; i++) th[off.bv + i] = -2;           // start with small clouds
for (let g = 0; g < G; g++) th[off.logSize + g] = Math.log(5);

const data = makeCells(2026);
const N = data.counts.length;
const xl = data.counts.map(x => Float64Array.from(x, v => Math.log1p(v)));
// decoder output bias starts at log(gene mean)
for (let g = 0; g < G; g++) {
  let s = 0; for (const x of data.counts) s += x[g];
  th[off.b3 + g] = Math.log(s / N + 1e-3);
}

function digamma(x: number): number {
  let r = 0;
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f / 252));
}
function nbLogLik(x: number, m: number, s: number): number {
  return lgamma(x + s) - lgamma(s) - lgamma(x + 1) + s * Math.log(s / (s + m)) + x * Math.log(m / (s + m) + 1e-300);
}

// scratch buffers
const a1 = new Float64Array(H), h1 = new Float64Array(H), mu = new Float64Array(Z), lv = new Float64Array(Z);
const eps = new Float64Array(Z), z = new Float64Array(Z), h2 = new Float64Array(H), eta = new Float64Array(G);
const deta = new Float64Array(G), dh2 = new Float64Array(H), dz = new Float64Array(Z), dh1 = new Float64Array(H);

/** One cell: forward, loss, and gradient accumulated into gr. Returns [nll, kl]. */
function step(i: number, beta: number, scale: number): [number, number] {
  const x = data.counts[i], xi = xl[i];
  for (let o = 0; o < H; o++) {
    let s = th[off.b1 + o];
    for (let k = 0; k < G; k++) s += th[off.W1 + o * G + k] * xi[k];
    a1[o] = s; h1[o] = Math.tanh(s);
  }
  for (let o = 0; o < Z; o++) {
    let s = th[off.bm + o], v = th[off.bv + o];
    for (let k = 0; k < H; k++) { s += th[off.Wm + o * H + k] * h1[k]; v += th[off.Wv + o * H + k] * h1[k]; }
    mu[o] = s; lv[o] = Math.max(-12, Math.min(6, v));
    eps[o] = R.norm(); z[o] = mu[o] + Math.exp(0.5 * lv[o]) * eps[o];
  }
  for (let o = 0; o < H; o++) {
    let s = th[off.b2 + o];
    for (let k = 0; k < Z; k++) s += th[off.W2 + o * Z + k] * z[k];
    h2[o] = Math.tanh(s);
  }
  let nll = 0, kl = 0;
  for (let g = 0; g < G; g++) {
    let s = th[off.b3 + g];
    for (let k = 0; k < H; k++) s += th[off.W3 + g * H + k] * h2[k];
    eta[g] = Math.min(s, 8);
    const m = Math.exp(eta[g]), ls = th[off.logSize + g], sz = Math.exp(ls);
    nll -= nbLogLik(x[g], m, sz);
    deta[g] = -sz * (x[g] - m) / (sz + m);
    const dls = -sz * (digamma(x[g] + sz) - digamma(sz) + Math.log(sz / (sz + m)) + 1 - (sz + x[g]) / (sz + m));
    gr[off.logSize + g] += scale * dls;
  }
  for (let o = 0; o < Z; o++) kl += 0.5 * (mu[o] * mu[o] + Math.exp(lv[o]) - lv[o] - 1);
  // decoder backward
  dh2.fill(0);
  for (let g = 0; g < G; g++) {
    const d = scale * deta[g];
    gr[off.b3 + g] += d;
    for (let k = 0; k < H; k++) { gr[off.W3 + g * H + k] += d * h2[k]; dh2[k] += deta[g] * th[off.W3 + g * H + k]; }
  }
  dz.fill(0);
  for (let o = 0; o < H; o++) {
    const da = dh2[o] * (1 - h2[o] * h2[o]);
    gr[off.b2 + o] += scale * da;
    for (let k = 0; k < Z; k++) { gr[off.W2 + o * Z + k] += scale * da * z[k]; dz[k] += da * th[off.W2 + o * Z + k]; }
  }
  // latent backward
  dh1.fill(0);
  for (let o = 0; o < Z; o++) {
    const sd = Math.exp(0.5 * lv[o]);
    const dmu = dz[o] + beta * mu[o];
    const dlv = dz[o] * eps[o] * 0.5 * sd + beta * 0.5 * (Math.exp(lv[o]) - 1);
    gr[off.bm + o] += scale * dmu; gr[off.bv + o] += scale * dlv;
    for (let k = 0; k < H; k++) {
      gr[off.Wm + o * H + k] += scale * dmu * h1[k]; gr[off.Wv + o * H + k] += scale * dlv * h1[k];
      dh1[k] += dmu * th[off.Wm + o * H + k] + dlv * th[off.Wv + o * H + k];
    }
  }
  for (let o = 0; o < H; o++) {
    const da = dh1[o] * (1 - h1[o] * h1[o]);
    gr[off.b1 + o] += scale * da;
    for (let k = 0; k < G; k++) gr[off.W1 + o * G + k] += scale * da * xi[k];
  }
  return [nll, kl];
}

// ---- Adam ----
let t = 0;
const order = Array.from({ length: N }, (_, i) => i);
for (let ep = 0; ep < EPOCHS; ep++) {
  const beta = Math.min(1, (ep + 1) / WARMUP);
  const lr = LR * (ep < EPOCHS * 0.7 ? 1 : 0.2);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(R.unif() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let sN = 0, sK = 0;
  for (let b0 = 0; b0 < N; b0 += BATCH) {
    gr.fill(0);
    const idx = order.slice(b0, b0 + BATCH);
    for (const i of idx) { const [a, k] = step(i, beta, 1 / idx.length); sN += a; sK += k; }
    t++;
    for (let p = 0; p < P; p++) {
      m1[p] = 0.9 * m1[p] + 0.1 * gr[p];
      m2[p] = 0.999 * m2[p] + 0.001 * gr[p] * gr[p];
      th[p] -= lr * (m1[p] / (1 - 0.9 ** t)) / (Math.sqrt(m2[p] / (1 - 0.999 ** t)) + 1e-8);
    }
  }
  if (ep % 50 === 0 || ep === EPOCHS - 1)
    console.error(`epoch ${ep}: NB neg. log-lik ${(sN / N).toFixed(2)} per cell, KL ${(sK / N).toFixed(2)}`);
}

// ---- export ----
const get = (n: string) => Array.from(th.subarray(off[n], off[n] + shapes.find(s => s[0] === n)![1]), v => Number(v.toPrecision(5)));
const w: VaeWeights = {
  G, H, Z,
  W1: get("W1"), b1: get("b1"), Wm: get("Wm"), bm: get("bm"), Wv: get("Wv"), bv: get("bv"),
  W2: get("W2"), b2: get("b2"), W3: get("W3"), b3: get("b3"), logSize: get("logSize"),
};

// ---- quality checks (on the exported, rounded weights) ----
const enc = data.counts.map(x => encode(w, x));
let nllV = 0, nllB = 0, mseV = 0, mseB = 0;
const gm = new Array(G).fill(0), glm = new Array(G).fill(0);
for (const x of data.counts) for (let g = 0; g < G; g++) { gm[g] += x[g] / N; glm[g] += Math.log1p(x[g]) / N; }
data.counts.forEach((x, i) => {
  const m = decode(w, enc[i].mu);
  for (let g = 0; g < G; g++) {
    const s = Math.exp(w.logSize[g]);
    nllV -= nbLogLik(x[g], m[g], s); nllB -= nbLogLik(x[g], gm[g], s);
    mseV += (Math.log1p(x[g]) - Math.log1p(m[g])) ** 2; mseB += (Math.log1p(x[g]) - glm[g]) ** 2;
  }
});
// PCA with 2 components on log1p, as a linear baseline (power iteration with deflation)
const C = Array.from({ length: G }, () => new Float64Array(G));
for (const x of xl) for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) C[a][b] += (x[a] - glm[a]) * (x[b] - glm[b]) / N;
const pcs: Float64Array[] = [];
for (let c = 0; c < 2; c++) {
  let v = new Float64Array(G).fill(1);
  for (let it = 0; it < 500; it++) {
    const u = new Float64Array(G);
    for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) u[a] += C[a][b] * v[b];
    for (const p of pcs) { let d = 0; for (let a = 0; a < G; a++) d += u[a] * p[a]; for (let a = 0; a < G; a++) u[a] -= d * p[a]; }
    const nrm = Math.hypot(...u); v = u.map(q => q / nrm);
  }
  pcs.push(v);
}
let msePca = 0;
for (const x of xl) {
  const sc = pcs.map(p => p.reduce((s, q, a) => s + q * (x[a] - glm[a]), 0));
  for (let a = 0; a < G; a++) msePca += (x[a] - glm[a] - sc[0] * pcs[0][a] - sc[1] * pcs[1][a]) ** 2;
}
// 15-NN accuracy in the 2D latent space (leave one out)
function knnAcc(lab: number[]): number {
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const d = enc.map((e, j) => [j === i ? Infinity : (e.mu[0] - enc[i].mu[0]) ** 2 + (e.mu[1] - enc[i].mu[1]) ** 2, j]).sort((p, q) => p[0] - q[0]);
    const votes = new Map<number, number>();
    for (let k = 0; k < 15; k++) votes.set(lab[d[k][1]], (votes.get(lab[d[k][1]]) ?? 0) + 1);
    const best = [...votes.entries()].sort((p, q) => q[1] - p[1])[0][0];
    if (best === lab[i]) ok++;
  }
  return ok / N;
}
const coarse = data.label.map(l => Math.min(l, 2));
const sdMean = enc.reduce((s, e) => s + e.sd[0] + e.sd[1], 0) / (2 * N);
console.error(`reconstruction NB neg. log-lik per cell: VAE ${(nllV / N).toFixed(2)}  vs gene-mean baseline ${(nllB / N).toFixed(2)}`);
console.error(`reconstruction MSE on log1p per cell: VAE(2D) ${(mseV / N).toFixed(3)}  PCA(2 PCs) ${(msePca / N).toFixed(3)}  gene-mean ${(mseB / N).toFixed(3)}`);
console.error(`15-NN accuracy in latent space: 5 labels ${knnAcc(data.label).toFixed(3)}, T/B/trajectory ${knnAcc(coarse).toFixed(3)}`);
console.error(`mean encoder sd ${sdMean.toFixed(3)}; NB size range ${Math.min(...w.logSize.map(Math.exp)).toFixed(2)}–${Math.max(...w.logSize.map(Math.exp)).toFixed(2)} (true 3–10)`);
for (let c = 0; c < LABELS.length; c++) {
  const e = enc.filter((_, i) => data.label[i] === c);
  console.error(`  ${LABELS[c]}: centre (${(e.reduce((s, q) => s + q.mu[0], 0) / e.length).toFixed(2)}, ${(e.reduce((s, q) => s + q.mu[1], 0) / e.length).toFixed(2)})`);
}

console.log(`// Generated by train.ts (see the command at its top). Do not edit by hand.
// ${EPOCHS} epochs, batch ${BATCH}, Adam lr ${LR}, KL warm-up ${WARMUP} epochs, seeds: data 2026, training 7.
// Final checks: NB neg. log-lik per cell ${(nllV / N).toFixed(2)} (gene-mean baseline ${(nllB / N).toFixed(2)}).
import type { VaeWeights } from "./vae";
export const VAE_WEIGHTS: VaeWeights = ${JSON.stringify(w)};`);
