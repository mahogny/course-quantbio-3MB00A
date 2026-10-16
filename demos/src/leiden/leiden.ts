// Leiden and Louvain community detection (no DOM), so it can be unit-tested with node.
// Quality function: modularity with a resolution parameter gamma,
//   Q = sum_c [ e_c / m  -  gamma * (K_c / 2m)^2 ],
// where e_c is the total weight of the edges inside community c, K_c the sum of the
// degrees (strengths) of its nodes and m the total edge weight. Internally we work with
// H = m * Q (in edge-weight units), as igraph and leidenalg do.
//
// Leiden follows Traag, Waltman & van Eck (2019), Sci Rep 9:5233, Algorithm A.2:
//  1. fast local moving: a queue of nodes; a node that moves puts its neighbours that are
//     not in its new community back on the queue;
//  2. refinement: inside every community S, start from singletons and merge only
//     well-connected nodes into well-connected sub-communities (randomly, Pr ~ exp(dH/theta));
//  3. aggregation on the refined partition, with the non-refined partition as the start;
//  4. repeat until local moving changes nothing; then repeat whole passes until stable.
// Louvain: local moving (sweeps in random order until no node moves) + aggregation on the
// same partition, no refinement.
import { rng } from "../lib/ui";

export type Rand = ReturnType<typeof rng>;
export type Algo = "leiden" | "louvain";

/** Weighted undirected graph in CSR form. Self-loops are kept apart (aggregated graphs). */
export interface WGraph {
  n: number;
  off: Int32Array;     // neighbours of v: nbr[off[v] .. off[v+1]-1]
  nbr: Int32Array;
  wt: Float64Array;
  self: Float64Array;  // self-loop weight (an edge inside the node, counted once)
  deg: Float64Array;   // strength: sum of incident weights + 2 * self
  m: number;           // total edge weight (each edge once, self-loops included)
}

/** Build a graph from an undirected edge list (i < j or any order; duplicates are summed). */
export function fromEdges(n: number, I: ArrayLike<number>, J: ArrayLike<number>, W: ArrayLike<number>, self?: ArrayLike<number>): WGraph {
  const maps: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const sl = new Float64Array(n);
  if (self) for (let v = 0; v < n; v++) sl[v] = self[v];
  for (let e = 0; e < I.length; e++) {
    const a = I[e], b = J[e], w = W[e];
    if (w === 0) continue;
    if (a === b) { sl[a] += w; continue; }
    maps[a].set(b, (maps[a].get(b) ?? 0) + w);
    maps[b].set(a, (maps[b].get(a) ?? 0) + w);
  }
  const off = new Int32Array(n + 1);
  for (let v = 0; v < n; v++) off[v + 1] = off[v] + maps[v].size;
  const nbr = new Int32Array(off[n]), wt = new Float64Array(off[n]), deg = new Float64Array(n);
  let m2 = 0;
  for (let v = 0; v < n; v++) {
    const keys = [...maps[v].keys()].sort((x, y) => x - y);
    let q = off[v], d = 2 * sl[v];
    for (const u of keys) { const w = maps[v].get(u)!; nbr[q] = u; wt[q] = w; d += w; q++; }
    deg[v] = d; m2 += d;
  }
  return { n, off, nbr, wt, self: sl, deg, m: m2 / 2 };
}

/** Renumber labels 0..K-1 by decreasing community size (ties: smallest first member). */
export function relabel(memb: ArrayLike<number>, size?: ArrayLike<number>): Int32Array {
  const n = memb.length, tot = new Map<number, number>(), first = new Map<number, number>();
  for (let v = 0; v < n; v++) {
    const c = memb[v];
    tot.set(c, (tot.get(c) ?? 0) + (size ? size[v] : 1));
    if (!first.has(c)) first.set(c, v);
  }
  const order = [...tot.keys()].sort((a, b) => tot.get(b)! - tot.get(a)! || first.get(a)! - first.get(b)!);
  const map = new Map<number, number>();
  order.forEach((c, q) => map.set(c, q));
  const out = new Int32Array(n);
  for (let v = 0; v < n; v++) out[v] = map.get(memb[v])!;
  return out;
}

export function nComm(memb: ArrayLike<number>): number { return new Set(Array.from(memb)).size; }

/** H = sum_c [ e_c - gamma K_c^2 / (4m) ] in edge-weight units. */
export function quality(G: WGraph, memb: ArrayLike<number>, gamma: number): number {
  const K = new Map<number, number>();
  let inside = 0;
  for (let v = 0; v < G.n; v++) {
    const c = memb[v];
    K.set(c, (K.get(c) ?? 0) + G.deg[v]);
    inside += G.self[v];
    for (let q = G.off[v]; q < G.off[v + 1]; q++) if (G.nbr[q] > v && memb[G.nbr[q]] === c) inside += G.wt[q];
  }
  let pen = 0;
  for (const k of K.values()) pen += k * k;
  return inside - gamma * pen / (4 * G.m);
}

/** Modularity Q with resolution gamma (the textbook normalisation, Q = H / m). */
export function modularity(G: WGraph, memb: ArrayLike<number>, gamma = 1): number {
  return G.m > 0 ? quality(G, memb, gamma) / G.m : 0;
}

function shuffled(n: number, r: Rand): Int32Array {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r.unif() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/** Helper state for moving nodes between communities. Community ids are 0..n-1. */
class Mover {
  K: Float64Array;              // total degree per community
  cnt: Int32Array;              // number of nodes per community
  wTo: Float64Array;            // scratch: weight from v to each community
  touched: number[] = [];
  empty: number[] = [];
  constructor(public G: WGraph, public memb: Int32Array, public gamma: number) {
    const n = G.n;
    this.K = new Float64Array(n); this.cnt = new Int32Array(n); this.wTo = new Float64Array(n);
    for (let v = 0; v < n; v++) { this.K[memb[v]] += G.deg[v]; this.cnt[memb[v]]++; }
    for (let c = n - 1; c >= 0; c--) if (this.cnt[c] === 0) this.empty.push(c);
  }
  /** Move v to the community with the largest gain (an empty one counts as 0). Returns true if it moved. */
  moveBest(v: number): boolean {
    const { G, memb, K, cnt, wTo, touched, gamma } = this;
    const twoM = 2 * G.m, kv = G.deg[v], old = memb[v];
    for (let q = G.off[v]; q < G.off[v + 1]; q++) {
      const c = memb[G.nbr[q]];
      if (wTo[c] === 0) touched.push(c);
      wTo[c] += G.wt[q];
    }
    K[old] -= kv; cnt[old]--;
    // value of v in community c: w(v, c) - gamma k_v K_c / 2m   (K_c without v)
    let best = old, bestVal = wTo[old] - gamma * kv * K[old] / twoM;
    for (const c of touched) {
      if (c === old) continue;
      const val = wTo[c] - gamma * kv * K[c] / twoM;
      if (val > bestVal + 1e-12) { best = c; bestVal = val; }
    }
    if (cnt[old] > 0 && bestVal < -1e-12) best = -1;     // alone in a new community is better
    for (const c of touched) wTo[c] = 0;
    touched.length = 0;
    if (best === -1) best = this.empty.pop()!;
    K[best] += kv; cnt[best]++;
    if (cnt[old] === 0 && best !== old) this.empty.push(old);
    memb[v] = best;
    return best !== old;
  }
}

/** Leiden's fast local move: queue of all nodes in random order. Mutates memb. */
export function fastLocalMove(G: WGraph, memb: Int32Array, gamma: number, r: Rand): number {
  const mv = new Mover(G, memb, gamma);
  const queue = Array.from(shuffled(G.n, r));
  const inQ = new Uint8Array(G.n).fill(1);
  let head = 0, moves = 0;
  while (head < queue.length) {
    const v = queue[head++];
    inQ[v] = 0;
    if (mv.moveBest(v)) {
      moves++;
      for (let q = G.off[v]; q < G.off[v + 1]; q++) {
        const u = G.nbr[q];
        if (!inQ[u] && memb[u] !== memb[v]) { inQ[u] = 1; queue.push(u); }
      }
    }
    if (head > 4096 && head * 2 > queue.length) { queue.splice(0, head); head = 0; }
  }
  return moves;
}

/** Louvain's local move: sweeps over all nodes (random order) until a sweep moves nothing. */
export function sweepLocalMove(G: WGraph, memb: Int32Array, gamma: number, r: Rand): number {
  const mv = new Mover(G, memb, gamma);
  let moves = 0;
  for (let sweep = 0; sweep < 1000; sweep++) {
    let moved = 0;
    for (const v of shuffled(G.n, r)) if (mv.moveBest(v)) moved++;
    moves += moved;
    if (moved === 0) break;
  }
  return moves;
}

/**
 * Leiden refinement: inside each community S of memb, start from singletons; visit the
 * well-connected nodes of S in random order; a node still on its own may join a
 * well-connected sub-community C of S with Pr ~ exp(dH/theta) over the C with dH >= 0
 * (staying alone has dH = 0). "Well-connected" for modularity: E(X, S - X) >= gamma K_X (K_S - K_X) / 2m.
 */
export function refine(G: WGraph, memb: Int32Array, gamma: number, r: Rand, theta = 0.01): Int32Array {
  const n = G.n, twoM = 2 * G.m;
  const ref = new Int32Array(n);
  for (let v = 0; v < n; v++) ref[v] = v;
  const Kref = Float64Array.from(G.deg);          // degree of each refined community
  const ext = new Float64Array(n);                // E(C, S - C) of each refined community
  const single = new Uint8Array(n).fill(1);       // community of v is still {v}
  const KS = new Map<number, number>();           // degree of each community S
  for (let v = 0; v < n; v++) KS.set(memb[v], (KS.get(memb[v]) ?? 0) + G.deg[v]);
  for (let v = 0; v < n; v++) {
    let e = 0;
    for (let q = G.off[v]; q < G.off[v + 1]; q++) if (memb[G.nbr[q]] === memb[v]) e += G.wt[q];
    ext[v] = e;
  }
  const wTo = new Float64Array(n), touched: number[] = [];
  for (const v of shuffled(n, r)) {
    const S = memb[v], kS = KS.get(S)!, kv = G.deg[v];
    if (!single[v]) continue;                                       // already merged into
    if (ext[v] < gamma * kv * (kS - kv) / twoM - 1e-12) continue;   // v not well-connected to S
    for (let q = G.off[v]; q < G.off[v + 1]; q++) {
      const u = G.nbr[q];
      if (memb[u] !== S) continue;
      const c = ref[u];
      if (wTo[c] === 0) touched.push(c);
      wTo[c] += G.wt[q];
    }
    const cand: number[] = [], dh: number[] = [];
    for (const c of touched) {
      if (c === ref[v]) continue;
      if (ext[c] < gamma * Kref[c] * (kS - Kref[c]) / twoM - 1e-12) continue;   // C not well-connected
      const d = wTo[c] - gamma * kv * Kref[c] / twoM;
      if (d >= 0) { cand.push(c); dh.push(d); }
    }
    if (cand.length > 0) {
      cand.push(ref[v]); dh.push(0);                       // staying alone is an option
      const mx = Math.max(...dh);
      const p = dh.map(d => Math.exp((d - mx) / theta));
      let u = r.unif() * p.reduce((s, x) => s + x, 0), pick = cand.length - 1;
      for (let q = 0; q < cand.length; q++) { u -= p[q]; if (u <= 0) { pick = q; break; } }
      const c = cand[pick];
      if (c !== ref[v]) {
        const wvc = wTo[c];
        ext[c] = ext[c] + ext[v] - 2 * wvc;
        Kref[c] += kv;
        ref[v] = c;
        single[v] = 0; single[c] = 0;                      // community c was {c}: no longer a singleton
      }
    }
    for (const c of touched) wTo[c] = 0;
    touched.length = 0;
  }
  return ref;
}

/** Collapse each community of `part` into one node. Returns the graph and node -> new node map. */
export function aggregate(G: WGraph, part: ArrayLike<number>): { G: WGraph; map: Int32Array } {
  const map = relabel(part);
  const nn = nComm(part);
  const I: number[] = [], J: number[] = [], W: number[] = [];
  const self = new Float64Array(nn);
  for (let v = 0; v < G.n; v++) {
    self[map[v]] += G.self[v];
    for (let q = G.off[v]; q < G.off[v + 1]; q++) {
      const u = G.nbr[q];
      if (u <= v) continue;
      const a = map[v], b = map[u];
      if (a === b) self[a] += G.wt[q];
      else { I.push(a); J.push(b); W.push(G.wt[q]); }
    }
  }
  return { G: fromEdges(nn, I, J, W, self), map };
}

// ---------------------------------------------------------------------------
// A run that can be stepped one phase at a time (for the demo) or run to the end.
// ---------------------------------------------------------------------------
export type Phase = "start" | "move" | "refine" | "aggregate" | "done";

export class Run {
  r: Rand;
  G: WGraph;                 // current (possibly aggregated) graph
  cellNode: Int32Array;      // cell -> node of G
  P: Int32Array;             // partition of the nodes of G
  refined: Int32Array | null = null;
  phase: Phase = "start";
  level = 0;                 // number of aggregations in this pass
  pass = 1;
  passStart: Int32Array;     // flat partition at the start of this pass
  log: string[] = [];

  constructor(public G0: WGraph, public gamma: number, public algo: Algo, seed: number, init?: Int32Array) {
    this.r = rng(seed);
    this.G = G0;
    this.cellNode = new Int32Array(G0.n);
    for (let v = 0; v < G0.n; v++) this.cellNode[v] = v;
    this.P = init ? Int32Array.from(init) : Int32Array.from(this.cellNode);
    this.passStart = this.flat();
  }

  /** Cluster label of every cell (labels by decreasing size). */
  flat(): Int32Array {
    const out = new Int32Array(this.G0.n);
    for (let v = 0; v < out.length; v++) out[v] = this.P[this.cellNode[v]];
    return relabel(out);
  }
  /** Refined sub-community of every cell (only meaningful right after "refine"). */
  flatRefined(): Int32Array {
    const R = this.refined ?? this.P, out = new Int32Array(this.G0.n);
    for (let v = 0; v < out.length; v++) out[v] = R[this.cellNode[v]];
    return relabel(out);
  }

  get done(): boolean { return this.phase === "done"; }

  /** Run the next phase. Returns a short description. */
  step(): string {
    const { gamma, r } = this;
    if (this.phase === "done") return "done";
    if (this.phase === "start" || this.phase === "aggregate") {
      const moves = this.algo === "leiden" ? fastLocalMove(this.G, this.P, gamma, r) : sweepLocalMove(this.G, this.P, gamma, r);
      this.phase = "move";
      const k = nComm(this.P);
      // done with this pass when every node is its own community (nothing left to merge)
      if (k === this.G.n) {
        const f = this.flat();
        const same = f.every((c, i) => c === this.passStart[i]);
        if (same || this.pass >= 20) { this.phase = "done"; return `local move: no change, finished (${k} clusters)`; }
        // start another pass on the cells, from the current clusters
        this.pass++; this.level = 0; this.G = this.G0;
        for (let v = 0; v < this.G0.n; v++) this.cellNode[v] = v;
        this.P = Int32Array.from(f); this.passStart = f;
        this.phase = "aggregate";                     // so that the next step is a local move
        return `${k} clusters; pass ${this.pass} starts again on the cells`;
      }
      return `local move: ${moves} moves, ${k} clusters`;
    }
    if (this.phase === "move" && this.algo === "leiden") {
      this.refined = refine(this.G, this.P, gamma, r);
      this.phase = "refine";
      return `refine: ${nComm(this.P)} clusters → ${nComm(this.refined)} sub-clusters`;
    }
    // aggregate (Leiden: on the refined partition; Louvain: on P itself)
    let part: Int32Array = this.algo === "leiden" && this.refined ? this.refined : this.P;
    // if refinement merged nothing, aggregating on it would not shrink the graph: use P instead
    if (nComm(part) === this.G.n) part = this.P;
    const { G, map } = aggregate(this.G, part);
    const P2 = new Int32Array(G.n);
    for (let v = 0; v < this.G.n; v++) P2[map[v]] = this.P[v];
    P2.set(relabel(P2));                              // labels 0..K-1 fit the smaller graph
    for (let c = 0; c < this.cellNode.length; c++) this.cellNode[c] = map[this.cellNode[c]];
    const from = this.G.n;
    this.G = G; this.P = P2; this.refined = null; this.level++;
    this.phase = "aggregate";
    return `aggregate: ${from} → ${G.n} nodes, in ${nComm(P2)} clusters`;
  }

  runAll(maxSteps = 10000): Int32Array {
    for (let s = 0; s < maxSteps && !this.done; s++) this.step();
    return this.flat();
  }
}

/** One-call clustering of a cell graph. */
export function cluster(G: WGraph, gamma: number, algo: Algo = "leiden", seed = 1): Int32Array {
  return new Run(G, gamma, algo, seed).runAll();
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------
/** Number of connected pieces of each cluster's induced subgraph (index = cluster label). */
export function pieces(G: WGraph, memb: ArrayLike<number>): number[] {
  const K = Math.max(-1, ...Array.from(memb)) + 1, out = new Array(K).fill(0);
  const seen = new Uint8Array(G.n);
  for (let s = 0; s < G.n; s++) {
    if (seen[s]) continue;
    const c = memb[s];
    out[c]++;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const v = stack.pop()!;
      for (let q = G.off[v]; q < G.off[v + 1]; q++) {
        const u = G.nbr[q];
        if (!seen[u] && memb[u] === c) { seen[u] = 1; stack.push(u); }
      }
    }
  }
  return out;
}

/** Contingency table rows = true groups, columns = clusters. */
export function contingency(truth: ArrayLike<number>, memb: ArrayLike<number>): number[][] {
  const R = Math.max(...Array.from(truth)) + 1, C = Math.max(...Array.from(memb)) + 1;
  const T = Array.from({ length: R }, () => new Array(C).fill(0));
  for (let i = 0; i < truth.length; i++) T[truth[i]][memb[i]]++;
  return T;
}

/** Adjusted Rand index (Hubert & Arabie 1985). */
export function ari(truth: ArrayLike<number>, memb: ArrayLike<number>): number {
  const T = contingency(truth, memb), n = truth.length;
  const c2 = (x: number) => x * (x - 1) / 2;
  let sij = 0, sa = 0, sb = 0;
  const colSum = new Array(T[0].length).fill(0);
  for (const row of T) { let rs = 0; row.forEach((x, j) => { sij += c2(x); rs += x; colSum[j] += x; }); sa += c2(rs); }
  for (const x of colSum) sb += c2(x);
  const exp = sa * sb / c2(n), mx = (sa + sb) / 2;
  return mx === exp ? 1 : (sij - exp) / (mx - exp);
}
