// The MNIST digit VAE of the vaegen demo: int8 weights from mnist_weights.ts, forward passes,
// and MNIST-style preprocessing of a drawing. No DOM, so it can be tested in node.
import { MNIST_VAE, type Q8Layer } from "./mnist_weights";

type V2 = [number, number];
interface Dense { W: Float32Array; b: Float32Array; nIn: number; nOut: number }
function deq(l: Q8Layer): Dense {
  const bin = atob(l.q), W = new Float32Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    const q = bin.charCodeAt(i), v = q > 127 ? q - 256 : q;
    W[i] = v * l.s[Math.floor(i / l.nIn)];
  }
  return { W, b: Float32Array.from(l.b), nIn: l.nIn, nOut: l.nOut };
}
function lin(d: Dense, x: ArrayLike<number>, relu: boolean): Float32Array {
  const y = new Float32Array(d.nOut);
  for (let o = 0; o < d.nOut; o++) {
    let s = d.b[o];
    const r = o * d.nIn;
    for (let i = 0; i < d.nIn; i++) s += d.W[r + i] * x[i];
    y[o] = relu ? Math.max(0, s) : s;
  }
  return y;
}
let NET: { e1: Dense; em: Dense; ev: Dense; d1: Dense; d2: Dense } | null = null;
function net() { return NET ??= { e1: deq(MNIST_VAE.e1), em: deq(MNIST_VAE.em), ev: deq(MNIST_VAE.ev), d1: deq(MNIST_VAE.d1), d2: deq(MNIST_VAE.d2) }; }
export function digitDecode(z: ArrayLike<number>): Float32Array {
  const n = net();
  return lin(n.d2, lin(n.d1, z, true), false).map(v => 1 / (1 + Math.exp(-v)));
}
export function digitEncode(img: ArrayLike<number>): { mu: V2; sd: V2 } {
  const n = net(), h = lin(n.e1, img, true), m = lin(n.em, h, false), v = lin(n.ev, h, false);
  return { mu: [m[0], m[1]], sd: [Math.exp(0.5 * v[0]), Math.exp(0.5 * v[1])] };
}

/**
 * MNIST-style preprocessing of a drawing (ink in [0, 1], D×D): crop to the ink's bounding box,
 * scale the longer side to 20 px (box filter), then shift so the centre of mass sits at (14, 14).
 */
export function preprocess(ink: Float32Array, D: number): Float32Array | null {
  let x0 = D, x1 = -1, y0 = D, y1 = -1;
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (ink[y * D + x] > 0.05) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, sc = 20 / Math.max(bw, bh);
  const box = new Float32Array(784);
  const ox = (28 - bw * sc) / 2, oy = (28 - bh * sc) / 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = ink[y * D + x];
    if (v <= 0) continue;
    const tx = Math.floor(ox + (x - x0 + 0.5) * sc), ty = Math.floor(oy + (y - y0 + 0.5) * sc);
    if (tx >= 0 && tx < 28 && ty >= 0 && ty < 28) box[ty * 28 + tx] += v * sc * sc;
  }
  let s = 0, cx = 0, cy = 0;
  for (let i = 0; i < 784; i++) { box[i] = Math.min(1, box[i]); s += box[i]; cx += box[i] * (i % 28); cy += box[i] * Math.floor(i / 28); }
  const dx = Math.round(14 - cx / s - 0.5), dy = Math.round(14 - cy / s - 0.5);
  const out = new Float32Array(784);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const X = x + dx, Y = y + dy;
    if (X >= 0 && X < 28 && Y >= 0 && Y < 28) out[Y * 28 + X] = box[y * 28 + x];
  }
  return out;
}

