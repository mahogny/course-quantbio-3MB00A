// Exact fractions (BigInt numerator / denominator), for the row-operation demos:
// students should see 1/3, never 0.3333. Always stored reduced, with d > 0.
export class Frac {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("division by zero");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = g > 1n ? n / g : n;
    this.d = g > 1n ? d / g : d;
  }
  static of(v: number | bigint, d: number | bigint = 1): Frac { return new Frac(BigInt(v), BigInt(d)); }
  add(o: Frac): Frac { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Frac): Frac { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Frac): Frac { return new Frac(this.n * o.n, this.d * o.d); }
  div(o: Frac): Frac { return new Frac(this.n * o.d, this.d * o.n); }
  neg(): Frac { return new Frac(-this.n, this.d); }
  abs(): Frac { return this.n < 0n ? this.neg() : this; }
  isZero(): boolean { return this.n === 0n; }
  isOne(): boolean { return this.n === 1n && this.d === 1n; }
  isInt(): boolean { return this.d === 1n; }
  sign(): number { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  eq(o: Frac): boolean { return this.n === o.n && this.d === o.d; }
  /** Plain text with a true minus sign: "−5/3". */
  toString(): string {
    const s = (this.n < 0n ? "−" : "") + (this.n < 0n ? -this.n : this.n).toString();
    return this.d === 1n ? s : `${s}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

export const ZERO = Frac.of(0), ONE = Frac.of(1);

/** Parse "3", "-2", "1/3", "−5/2", "0.25", "1.5/2" into an exact fraction; null if invalid. */
export function parseFrac(s: string): Frac | null {
  const t = s.trim().replace(/[−–]/g, "-").replace(",", ".");
  if (t === "") return null;
  const parts = t.split("/");
  if (parts.length > 2) return null;
  const num = parseDec(parts[0]);
  const den = parts.length === 2 ? parseDec(parts[1]) : ONE;
  if (!num || !den || den.isZero()) return null;
  return num.div(den);
}

function parseDec(s: string): Frac | null {
  const m = /^\s*([+-]?)(\d*)(?:\.(\d*))?\s*$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return null;
  const frac = m[3] ?? "";
  const v = new Frac(BigInt((m[2] || "0") + frac), 10n ** BigInt(frac.length));
  return m[1] === "-" ? v.neg() : v;
}
