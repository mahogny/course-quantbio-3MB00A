// Pure maths and number formatting for the matmul demo (no DOM).
// A matrix is stored row-major as rows of numbers; only the top-left block is in use.
export type Mat = number[][];

export const MAX = 5;   // largest m, n, p

/** An r × c block of zeros. */
export function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => new Array<number>(c).fill(0));
}

/** C = A·B for A (m × n) and B (n × p), reading only those blocks of the stored matrices. */
export function product(A: Mat, B: Mat, m: number, n: number, p: number): Mat {
  const C = zeros(m, p);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  return C;
}

/** Number for display: rounded to 2 decimals, a real minus sign, no "-0". */
export function fmt(x: number): string {
  const r = Number(x.toFixed(2));
  return (Object.is(r, -0) ? "0" : String(r)).replace("-", "−");
}

/** Number inside a product, in brackets when negative: (−2)·3. */
export function fmtP(x: number): string {
  const s = fmt(x);
  return s.startsWith("−") ? `(${s})` : s;
}

/** Parse a typed cell: accepts "−" or "-", "," or "." as decimal mark. NaN if not a number. */
export function parseCell(s: string): number {
  const t = s.trim().replace("−", "-").replace(",", ".");
  return t === "" || t === "-" ? NaN : Number(t);
}
