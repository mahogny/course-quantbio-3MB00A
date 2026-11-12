// Matrix times matrix, for matrices of different sizes. A is m × n, B is n × p, and
// C = A·B (m × p) updates live. One slider sets the shared inner size n, so the sizes
// always match; the size rule (m × n)·(n × p) → (m × p) is shown under the matrices.
// Cells of A and B are editable; "Random" fills them with small integers. Hover a cell
// of C (or click/tap it to keep it): row i of A and column j of B light up, each pair
// of factors in its own colour, and the sum is written out with the same colours.
// Auto-mounts on <div data-demo="matmul">. Optional (A and B row-major):
//   data-m="2" data-n="3" data-p="3"   sizes, 1-5 each
//   data-a="2 0 1  1 -2 3"             A, m·n numbers
//   data-b="1 0 4  2 1 0  -1 3 5"      B, n·p numbers
//   data-sel="2 3"                     selected cell of C at the start (row, column)
//   data-seed="3"                      seed for the "Random" button
import { htmlEl, slider, button, numList, autoMount, rng } from "../lib/ui";
import { Mat, MAX, zeros, product, fmt, fmtP, parseCell } from "./math";

const NAME = "matmul";
// one colour per factor pair k = 1..5 (row i of A, column j of B)
const PAIR = ["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd", "#c2399a"];

const STYLE = `
.qb-demo[data-demo="${NAME}"] { flex-direction: column; align-items: stretch; gap: .55em; }
.qb-demo[data-demo="${NAME}"] .mm-ctl { display: flex; flex-wrap: wrap; gap: .3em 1.4em; align-items: center; }
.qb-demo[data-demo="${NAME}"] .mm-ctl .qb-slider { flex: 0 1 auto; grid-template-columns: auto 6em 1.4em; }
.qb-demo[data-demo="${NAME}"] .mm-ctl .qb-slider input[type=range] { min-width: 4em; }
.qb-demo[data-demo="${NAME}"] .mm-btns { display: flex; gap: .4em; }
.qb-demo[data-demo="${NAME}"] .mm-row { display: flex; flex-wrap: wrap; align-items: center; gap: .2em .6em; }
.qb-demo[data-demo="${NAME}"] .mm-op { font-size: 1.6em; font-weight: 600; padding-top: .5em; }
.qb-demo[data-demo="${NAME}"] .mm-block { display: flex; flex-direction: column; align-items: center; gap: .2em; }
.qb-demo[data-demo="${NAME}"] .mm-cap { font-size: .95em; }
.qb-demo[data-demo="${NAME}"] .mm-cap b { font-size: 1.15em; }
.qb-demo[data-demo="${NAME}"] .mm-mat { display: grid; gap: 3px; --cw: 2.6em; --ch: 2.05em; }
.qb-demo[data-demo="${NAME}"] .mm-br { border-left: 2.5px solid var(--qb-fg); border-right: 2.5px solid var(--qb-fg);
  border-radius: 7px; margin: -3px -6px; pointer-events: none; }
.qb-demo[data-demo="${NAME}"] .mm-idx { font-size: .8em; color: var(--qb-muted); text-align: center; align-self: end; line-height: 1.2; }
.qb-demo[data-demo="${NAME}"] .mm-idx.r { align-self: center; padding-right: .7em; }
.qb-demo[data-demo="${NAME}"] .mm-idx.on { color: var(--qb-fg); font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .mm-cell { box-sizing: border-box; width: var(--cw); height: var(--ch); margin: 0;
  font: inherit; font-family: ui-monospace, monospace; text-align: center; padding: 0;
  border: 1px solid #ccc; border-radius: 4px; background: var(--qb-bg); color: var(--qb-fg); }
.qb-demo[data-demo="${NAME}"] input.mm-cell:focus { outline: 2px solid var(--qb-accent); outline-offset: 0; }
.qb-demo[data-demo="${NAME}"] input.mm-cell.bad { border-color: var(--qb-c2); background: #fde8e8; }
.qb-demo[data-demo="${NAME}"] .mm-cell.pair { border-width: 2.5px; font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .mm-c { display: flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--qb-panel); touch-action: manipulation; }
.qb-demo[data-demo="${NAME}"] .mm-c:hover { border-color: var(--qb-fg); }
.qb-demo[data-demo="${NAME}"] .mm-c.sel { border: 3px solid var(--qb-fg); background: #fff3c4; font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .mm-rule { font-size: 1.05em; }
.qb-demo[data-demo="${NAME}"] .mm-rule .in { color: var(--qb-c3); font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .mm-rule .out { font-weight: 700; }
.qb-demo[data-demo="${NAME}"] .qb-readout { font-size: 1.05em; line-height: 1.5; white-space: normal; }
.qb-demo[data-demo="${NAME}"] .mm-t { font-weight: 700; white-space: nowrap; }
.reveal .qb-demo[data-demo="${NAME}"] { font-size: 20px; gap: .4em; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-btn { font-size: 18px; }
.reveal .qb-demo[data-demo="${NAME}"] .mm-mat { --cw: 2.5em; --ch: 1.85em; }
.reveal .qb-demo[data-demo="${NAME}"] .mm-idx { font-size: 18px; }
.reveal .qb-demo[data-demo="${NAME}"] .qb-note { font-size: 18px; }
`;

function injectStyle(): void {
  if (document.getElementById("qb-style-" + NAME)) return;
  const s = document.createElement("style");
  s.id = "qb-style-" + NAME;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

type Cell = [number, number];   // (row, column), 0-based

function mount(host: HTMLElement): void {
  injectStyle();
  const clampSize = (v: string | undefined, d: number) => Math.max(1, Math.min(MAX, Math.round(Number(v ?? d)) || d));
  const m0 = clampSize(host.dataset.m, 2), n0 = clampSize(host.dataset.n, 3), p0 = clampSize(host.dataset.p, 3);
  const R = rng(Number(host.dataset.seed ?? 3));
  const randInt = () => Math.floor(R.unif() * 8) - 2;    // -2 .. 5

  // A and B are stored as full 5 × 5 blocks, so shrinking and growing a size keeps the values.
  const A: Mat = zeros(MAX, MAX), B: Mat = zeros(MAX, MAX);
  const randomise = () => { for (const M of [A, B]) for (const row of M) for (let k = 0; k < MAX; k++) row[k] = randInt(); };
  const a0 = numList(host.dataset.a, [2, 0, 1, 1, -2, 3]);
  const b0 = numList(host.dataset.b, [1, 0, 4, 2, 1, 0, -1, 3, 5]);
  const example = () => {
    randomise();   // cells outside the example block get small random values
    for (let i = 0; i < m0; i++) for (let k = 0; k < n0; k++) A[i][k] = a0[i * n0 + k] ?? 0;
    for (let k = 0; k < n0; k++) for (let j = 0; j < p0; j++) B[k][j] = b0[k * p0 + j] ?? 0;
  };
  example();
  const s0 = numList(host.dataset.sel, [1, 1]);
  const st = { m: m0, n: n0, p: p0, pin: [s0[0] - 1, s0[1] - 1] as Cell, hov: null as Cell | null };

  // ---- controls ----
  const ctl = htmlEl("div", "mm-ctl", "", host);
  const int = (v: number) => String(v);
  const mS = slider(ctl, "rows of A: m", 1, MAX, 1, st.m, v => { st.m = v; build(); }, int);
  const nS = slider(ctl, "columns of A = rows of B: n", 1, MAX, 1, st.n, v => { st.n = v; build(); }, int);
  const pS = slider(ctl, "columns of B: p", 1, MAX, 1, st.p, v => { st.p = v; build(); }, int);
  const btns = htmlEl("div", "mm-btns", "", ctl);
  button(btns, "Random", () => { randomise(); build(); });
  button(btns, "Example", () => {
    example(); st.m = m0; st.n = n0; st.p = p0; st.pin = [s0[0] - 1, s0[1] - 1];
    mS.set(m0); nS.set(n0); pS.set(p0); build();
  });

  // ---- A · B = C ----
  const row = htmlEl("div", "mm-row", "", host);
  const rule = htmlEl("div", "mm-rule", "", host);
  const eq = htmlEl("div", "qb-readout", "", host);
  htmlEl("div", "qb-note", "Hover over a cell of C, or click/tap it to keep it selected. Type in A and B to change the numbers.", host);

  let aIn: HTMLInputElement[][] = [], bIn: HTMLInputElement[][] = [], cOut: HTMLDivElement[][] = [];
  let idx: { aR: HTMLElement[]; bC: HTMLElement[]; cR: HTMLElement[]; cC: HTMLElement[] } = { aR: [], bC: [], cR: [], cC: [] };

  /** One bracketed matrix with row and column numbers; `cell` makes each entry. */
  function matrix<E extends HTMLElement>(parent: HTMLElement, name: string, r: number, c: number,
    cell: (g: HTMLElement, i: number, j: number) => E): { cells: E[][]; rows: HTMLElement[]; cols: HTMLElement[] } {
    const block = htmlEl("div", "mm-block", "", parent);
    const g = htmlEl("div", "mm-mat", "", block);
    g.style.gridTemplateColumns = `auto repeat(${c}, var(--cw))`;
    g.style.gridTemplateRows = `auto repeat(${r}, var(--ch))`;
    const br = htmlEl("div", "mm-br", "", g);
    br.style.gridArea = `2 / 2 / ${r + 2} / ${c + 2}`;
    const cols = [...Array(c)].map((_, j) => place(htmlEl("div", "mm-idx", String(j + 1), g), 1, j + 2));
    const rows = [...Array(r)].map((_, i) => place(htmlEl("div", "mm-idx r", String(i + 1), g), i + 2, 1));
    const cells = [...Array(r)].map((_, i) => [...Array(c)].map((_, j) => place(cell(g, i, j), i + 2, j + 2)));
    htmlEl("div", "mm-cap", "", block).innerHTML = `<b>${name}</b>  (${r} × ${c})`;
    return { cells, rows, cols };
  }
  function place<E extends HTMLElement>(e: E, r: number, c: number): E {
    e.style.gridRow = String(r); e.style.gridColumn = String(c);
    return e;
  }
  /** An editable entry of A or B. */
  function inputCell(M: Mat, what: string) {
    return (g: HTMLElement, i: number, j: number) => {
      const inp = htmlEl("input", "mm-cell", "", g);
      inp.type = "text"; inp.value = fmt(M[i][j]); inp.setAttribute("aria-label", `${what} row ${i + 1}, column ${j + 1}`);
      inp.addEventListener("input", () => {
        const v = parseCell(inp.value);
        inp.classList.toggle("bad", !Number.isFinite(v));
        if (Number.isFinite(v)) { M[i][j] = v; update(); }
      });
      inp.addEventListener("change", () => { inp.value = fmt(M[i][j]); inp.classList.remove("bad"); inp.blur(); });
      inp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") inp.blur(); });
      return inp;
    };
  }

  /** Rebuild the three matrices (sizes changed, or new values). */
  function build(): void {
    st.pin = [Math.min(st.pin[0], st.m - 1), Math.min(st.pin[1], st.p - 1)];
    st.hov = null;
    row.innerHTML = "";
    const a = matrix(row, "A", st.m, st.n, inputCell(A, "A"));
    htmlEl("div", "mm-op", "·", row);
    const b = matrix(row, "B", st.n, st.p, inputCell(B, "B"));
    htmlEl("div", "mm-op", "=", row);
    const c = matrix(row, "C", st.m, st.p, (g, i, j) => {
      const d = htmlEl("div", "mm-cell mm-c", "", g);
      d.setAttribute("aria-label", `C row ${i + 1}, column ${j + 1}`);
      // a mouse previews on hover; a click or tap pins the cell
      d.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { st.hov = [i, j]; update(); } });
      d.addEventListener("click", () => { st.pin = [i, j]; st.hov = null; update(); });
      return d;
    });
    c.cells[0][0].parentElement!.addEventListener("pointerleave", () => { st.hov = null; update(); });
    aIn = a.cells; bIn = b.cells; cOut = c.cells;
    idx = { aR: a.rows, bC: b.cols, cR: c.rows, cC: c.cols };
    rule.innerHTML = `Size rule: (${st.m} × <span class="in">${st.n}</span>) · (<span class="in">${st.n}</span> × ${st.p})`
      + ` → <span class="out">(${st.m} × ${st.p})</span>.  Inner sizes match: columns of A = rows of B = ${st.n}.`;
    update();
  }

  /** Recompute C and redraw the highlight and the written-out sum. */
  function update(): void {
    const { m, n, p } = st;
    const C = product(A, B, m, n, p);
    const [si, sj] = st.hov ?? st.pin;
    for (let i = 0; i < m; i++) for (let j = 0; j < p; j++) {
      cOut[i][j].textContent = fmt(C[i][j]);
      cOut[i][j].classList.toggle("sel", i === si && j === sj);
    }
    // colour the factor pairs: A[si, k] and B[k, sj] share colour k
    const paint = (e: HTMLElement, col: string | null) => {
      e.classList.toggle("pair", col !== null);
      e.style.borderColor = col ?? "";
      e.style.background = col ? col + "2e" : "";
    };
    for (let i = 0; i < m; i++) for (let k = 0; k < n; k++) paint(aIn[i][k], i === si ? PAIR[k] : null);
    for (let k = 0; k < n; k++) for (let j = 0; j < p; j++) paint(bIn[k][j], j === sj ? PAIR[k] : null);
    idx.aR.forEach((e, i) => e.classList.toggle("on", i === si));
    idx.cR.forEach((e, i) => e.classList.toggle("on", i === si));
    idx.bC.forEach((e, j) => e.classList.toggle("on", j === sj));
    idx.cC.forEach((e, j) => e.classList.toggle("on", j === sj));

    const t = (k: number, s: string) => `<span class="mm-t" style="color:${PAIR[k]}">${s}</span>`;
    const ks = [...Array(n).keys()];
    const pairs = ks.map(k => t(k, `${fmtP(A[si][k])}·${fmtP(B[k][sj])}`)).join(" + ");
    const prods = ks.map(k => t(k, fmtP(A[si][k] * B[k][sj]))).join(" + ");
    eq.innerHTML = `C[${si + 1},${sj + 1}] = row ${si + 1} of A · column ${sj + 1} of B<br>`
      + `= ${pairs}<br>`
      + (n > 1 ? `= ${prods} ` : "") + `= <b>${fmt(C[si][sj])}</b>`;
  }

  build();
}

autoMount(NAME, mount);
