// Shared DOM for the row-operation demos (elimination, inverse). One step at a time:
// the operation in notation and in words, the matrix before and after, with the pivot,
// the changed row and the new 0 (or 1) highlighted, and the row arithmetic written out.
// Left: the editable system (size 2×2 to 4×4), random examples, reset.
// Exact fractions only (frac.ts); maths in rowops.ts.
import { htmlEl, button, rng } from "./ui";
import { Frac, parseFrac } from "./frac";
import {
  M, Op, Step, Kind, solveSteps, inverseSteps, randomSystem, randomInvertible,
} from "./rowops";

export type Mode = "solve" | "inverse";

const VARS = ["x", "y", "z", "w"];
const STYLE_ID = "qb-style-rowops";
const STYLE = `
.qb-demo.ro { flex-wrap: nowrap; gap: 1.4em; }
.qb-demo.ro .ro-left { flex: 0 0 auto; max-width: 300px; display: flex; flex-direction: column; gap: .5em; }
.qb-demo.ro .ro-right { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: .45em; }
.qb-demo.ro .ro-in { display: grid; justify-content: start; gap: 4px 4px; align-items: center; justify-items: center; }
.qb-demo.ro .ro-in input { font: inherit; font-family: ui-monospace, monospace; width: 3.1em; box-sizing: border-box;
  text-align: center; border: 1px solid #bbb; border-radius: 4px; padding: 2px 0; background: var(--qb-bg); color: var(--qb-fg); }
.qb-demo.ro .ro-in input.bad { border-color: var(--qb-c2); background: #fde0e0; }
.qb-demo.ro .ro-in .h { font-size: .8em; color: var(--qb-muted); font-style: italic; }
.qb-demo.ro .ro-in .bar { width: 2px; align-self: stretch; background: var(--qb-fg); }
.qb-demo.ro .ro-nav { display: flex; align-items: center; gap: .4em; flex-wrap: wrap; }
.qb-demo.ro .ro-count { font-size: .85em; color: var(--qb-muted); margin-left: .3em; }
.qb-demo.ro .ro-title { font-size: 1.2em; font-weight: 700; }
.qb-demo.ro .ro-title .op { font-family: ui-monospace, monospace; color: var(--qb-accent); }
.qb-demo.ro .ro-text { line-height: 1.45; }
.qb-demo.ro .ro-text p { margin: .15em 0; }
.qb-demo.ro .ro-body { display: flex; align-items: center; gap: .8em; flex-wrap: wrap; }
.qb-demo.ro .ro-arrow { display: flex; flex-direction: column; align-items: center; font-size: .8em; color: var(--qb-muted); }
.qb-demo.ro .ro-arrow b { font-size: 1.8em; line-height: 1; color: var(--qb-fg); font-weight: 400; }
.qb-demo.ro .ro-cap { font-size: .75em; color: var(--qb-muted); text-align: center; margin-bottom: .1em; }
.qb-demo.ro table { margin: 0; width: auto; border: 0; }
.qb-demo.ro table td { border: 0; line-height: 1.2; vertical-align: middle; }
.qb-demo.ro table.ro-m { border-collapse: separate; border-spacing: 0; font-family: ui-monospace, monospace; }
.qb-demo.ro table.ro-m td { padding: .12em .4em; text-align: center; min-width: 1.6em; height: 1.75em; }
.qb-demo.ro table.ro-m td.rl { font-family: system-ui, sans-serif; font-size: .75em; color: var(--qb-muted); padding-right: .3em; min-width: 0; }
.qb-demo.ro table.ro-m td.hd { font-family: system-ui, sans-serif; font-style: italic; font-size: .75em; color: var(--qb-muted); height: auto; padding-bottom: 0; }
.qb-demo.ro table.ro-m td.bk { min-width: 0; width: .3em; padding: 0; }
.qb-demo.ro table.ro-m td.bl { border-left: 2px solid var(--qb-fg); }
.qb-demo.ro table.ro-m td.br { border-right: 2px solid var(--qb-fg); }
.qb-demo.ro table.ro-m tr.top td.bk { border-top: 2px solid var(--qb-fg); }
.qb-demo.ro table.ro-m tr.bot td.bk { border-bottom: 2px solid var(--qb-fg); }
.qb-demo.ro table.ro-m td.bar { border-left: 2px solid var(--qb-fg); }
.qb-demo.ro tr.chg td:not(.rl):not(.bk) { background: #fff1b8; }
.qb-demo.ro tr.src td:not(.rl):not(.bk) { background: #dcecfa; }
.qb-demo.ro tr.badr td:not(.rl):not(.bk) { background: #fbd5d5; }
.qb-demo.ro tr.chg td.rl, .qb-demo.ro tr.badr td.rl { color: var(--qb-fg); font-weight: 700; }
.qb-demo.ro td.pv { box-shadow: inset 0 0 0 2.5px var(--qb-accent); border-radius: 50%; font-weight: 700; }
.qb-demo.ro td.new { box-shadow: inset 0 0 0 2.5px #2ca02c; color: #1d7a1d; font-weight: 700; border-radius: 4px; }
.qb-demo.ro td.zp { box-shadow: inset 0 0 0 2.5px var(--qb-c2); color: var(--qb-c2); font-weight: 700; border-radius: 4px; }
.qb-demo.ro td.inv { background: #e6f4e6; }
.qb-demo.ro .ro-fr { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: .78em; line-height: 1.05; }
.qb-demo.ro .ro-fr > span:first-child { border-bottom: 1.5px solid currentColor; padding: 0 .1em; }
.qb-demo.ro table.ro-ar { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: .9em; }
.qb-demo.ro table.ro-ar td { padding: .05em .45em; text-align: right; }
.qb-demo.ro table.ro-ar td:first-child { text-align: left; font-family: system-ui, sans-serif; white-space: nowrap; }
.qb-demo.ro table.ro-ar td.bar { border-left: 1.5px solid var(--qb-fg); }
.qb-demo.ro table.ro-ar tr.sum td { border-top: 1.5px solid var(--qb-fg); font-weight: 700; }
.qb-demo.ro .ro-eqs { font-family: ui-monospace, monospace; line-height: 1.7; }
.qb-demo.ro .ro-eqs .cur { background: #fff1b8; border-radius: 4px; padding: 0 .2em; }
.qb-demo.ro .ro-key { font-size: .75em; color: var(--qb-muted); display: flex; gap: 1em; flex-wrap: wrap; }
.qb-demo.ro .ro-key span::before { content: ""; display: inline-block; width: .9em; height: .9em; margin-right: .3em; vertical-align: -.1em; border-radius: 3px; }
.qb-demo.ro .ro-key .k-pv::before { box-shadow: inset 0 0 0 2px var(--qb-accent); border-radius: 50%; }
.qb-demo.ro .ro-key .k-chg::before { background: #fff1b8; }
.qb-demo.ro .ro-key .k-src::before { background: #dcecfa; }
.qb-demo.ro .ro-key .k-new::before { box-shadow: inset 0 0 0 2px #2ca02c; }
.qb-demo.ro .ro-ok { color: #1d7a1d; font-weight: 700; }
.qb-demo.ro .ro-no { color: var(--qb-c2); font-weight: 700; }
.qb-demo.ro .ro-all { display: flex; flex-direction: column; gap: .3em; }
.qb-demo.ro .ro-card { border-top: 1px solid var(--qb-grid); padding-top: .4em; display: flex; flex-direction: column; gap: .35em; }
.qb-demo.ro .ro-left .qb-presets .qb-btn { padding: .2em .5em; }
.qb-demo.ro .ro-err { color: var(--qb-c2); font-size: .85em; }
.reveal .qb-demo.ro { font-size: 19px; gap: 1em; }
.reveal .qb-demo.ro .ro-text, .reveal .qb-demo.ro .qb-note { font-size: 18px; }
.reveal .qb-demo.ro .ro-all { max-height: 470px; overflow-y: auto; }
.reveal .qb-demo.ro table.ro-m td { height: 1.55em; padding: .05em .35em; }
@media (max-width: 760px) {
  .qb-demo.ro { flex-wrap: wrap; }
}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = STYLE;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- formatting

/** A fraction as HTML: integers plain, fractions stacked; minus sign outside. */
export function fr(f: Frac): string {
  const neg = f.sign() < 0, a = f.abs();
  const body = a.isInt() ? a.n.toString() : `<span class="ro-fr"><span>${a.n}</span><span>${a.d}</span></span>`;
  return (neg ? "−" : "") + body;
}
/** In parentheses when negative, e.g. as a factor: 2·(−1). */
const par = (f: Frac) => (f.sign() < 0 ? `(${fr(f)})` : fr(f));
const R = (i: number) => `R${i + 1}`;

/** "2y − z", coefficient 1 written as just the letter. Zero terms are left out. */
function lhs(coefs: Frac[], names: string[]): string {
  let s = "";
  coefs.forEach((c, k) => {
    if (c.isZero()) return;
    const neg = c.sign() < 0, a = c.abs();
    const coef = a.isOne() ? "" : fr(a);
    s += s === "" ? (neg ? "−" : "") + coef + names[k] : (neg ? " − " : " + ") + coef + names[k];
  });
  return s === "" ? "0" : s;
}

/** "0x + 0y + 0z" for a zero row. */
const zeroLhs = (n: number) => VARS.slice(0, n).map(v => "0" + v).join(" + ");

// ---------------------------------------------------------------- matrices

interface Marks {
  chg?: number[]; src?: number; bad?: number[]; pv?: [number, number];
  newc?: [number, number]; zp?: [number, number]; inv?: boolean;
}

function matrix(mat: M, nLeft: number, mode: Mode, mk: Marks = {}, cap = ""): string {
  const rows = mat.length, cols = mat[0].length;
  let h = `<div>${cap ? `<div class="ro-cap">${cap}</div>` : ""}<table class="ro-m">`;
  if (mode === "solve") {
    h += `<tr><td class="rl"></td><td class="bk"></td>`;
    for (let j = 0; j < cols; j++) h += `<td class="hd">${j < nLeft ? VARS[j] : "b"}</td>`;
    h += `<td class="bk"></td></tr>`;
  }
  for (let i = 0; i < rows; i++) {
    const cls = [i === 0 ? "top" : "", i === rows - 1 ? "bot" : "",
      mk.bad?.includes(i) ? "badr" : mk.chg?.includes(i) ? "chg" : mk.src === i ? "src" : ""].join(" ");
    h += `<tr class="${cls}"><td class="rl">${R(i)}</td><td class="bk bl"></td>`;
    for (let j = 0; j < cols; j++) {
      const c: string[] = [];
      if (j === nLeft) c.push("bar");
      if (mk.inv && j >= nLeft) c.push("inv");
      const at = (p?: [number, number]) => p && p[0] === i && p[1] === j;
      if (at(mk.newc)) c.push("new"); else if (at(mk.zp)) c.push("zp"); else if (at(mk.pv)) c.push("pv");
      h += `<td class="${c.join(" ")}">${fr(mat[i][j])}</td>`;
    }
    h += `<td class="bk br"></td></tr>`;
  }
  return h + `</table></div>`;
}

const arrow = (label: string) => `<div class="ro-arrow"><span>${label}</span><b>⟶</b></div>`;

/** Row arithmetic, as on the slides: R3 / − 2·R1 / new R3. */
function arithmetic(op: Op, before: M, after: M, nLeft: number): string {
  const cells = (row: Frac[]) => row.map((v, k) => `<td${k === nLeft ? ' class="bar"' : ""}>${fr(v)}</td>`).join("");
  if (op.kind === "elim") {
    const neg = op.m.sign() < 0, a = op.m.abs();
    const lbl = `${neg ? "+" : "−"} ${a.isOne() ? "" : fr(a) + "·"}${R(op.src)}`;
    return `<table class="ro-ar"><tr><td>${R(op.target)}</td>${cells(before[op.target])}</tr>`
      + `<tr><td>${lbl}</td>${cells(before[op.src].map(v => v.mul(a)))}</tr>`
      + `<tr class="sum"><td>new ${R(op.target)}</td>${cells(after[op.target])}</tr></table>`;
  }
  if (op.kind === "scale") {
    return `<table class="ro-ar"><tr><td>${R(op.row)}</td>${cells(before[op.row])}</tr>`
      + `<tr class="sum"><td>÷ ${par(op.pivot)}</td>${cells(after[op.row])}</tr></table>`;
  }
  return "";
}

// ---------------------------------------------------------------- step text

interface View { title: string; text: string; body: string }

function colName(c: number, mode: Mode): string {
  return mode === "solve" ? `column ${c + 1} (${VARS[c]})` : `column ${c + 1}`;
}

function equations(mat: M, n: number, cur = -1): string {
  return `<div class="ro-eqs">${mat.map((r, i) =>
    `<div><span class="${i === cur ? "cur" : ""}">${lhs(r.slice(0, n), VARS)} = ${fr(r[n])}</span></div>`).join("")}</div>`;
}

const KEY_OP = `<div class="ro-key"><span class="k-pv">pivot</span><span class="k-src">row used</span>`
  + `<span class="k-chg">row changed</span><span class="k-new">new 0 or 1</span></div>`;

function viewOp(op: Op, before: M, after: M, note: string | undefined, nLeft: number, mode: Mode): View {
  const cn = colName(op.col, mode);
  if (op.kind === "swap") {
    const title = `<span class="op">${R(op.i)} ↔ ${R(op.j)}</span>`;
    const text = `<p>Swap rows ${R(op.i)} and ${R(op.j)}. The pivot spot in ${cn}, row ${R(op.i)}, holds <b>0</b>, `
      + `and we can never divide by 0. ${R(op.j)} has a non-zero number in ${cn}, so it moves up.</p>`
      + `<p>Swapping two ${mode === "solve" ? "equations" : "rows"} does not change the ${mode === "solve" ? "solution" : "result"}.</p>`;
    const body = matrix(before, nLeft, mode, { chg: [op.i, op.j], zp: [op.i, op.col] }, "before")
      + arrow(`${R(op.i)} ↔ ${R(op.j)}`)
      + matrix(after, nLeft, mode, { chg: [op.i, op.j], pv: [op.i, op.col] }, "after");
    return { title, text, body };
  }
  if (op.kind === "elim") {
    const neg = op.m.sign() < 0, a = op.m.abs(), one = a.isOne();
    const mult = one ? "" : fr(a) + "·";
    const opTxt = `${R(op.target)} ← ${R(op.target)} ${neg ? "+" : "−"} ${mult}${R(op.src)}`;
    const words = `${neg ? "Add" : "Subtract"} ${one ? "" : fr(a) + " × "}${R(op.src)} ${neg ? "to" : "from"} ${R(op.target)}, `
      + `to make a 0 ${op.dir} the pivot in ${cn}.`;
    const entry = before[op.target][op.col], piv = before[op.src][op.col];
    let why = `The multiplier is (number to remove) ÷ (pivot) = ${par(entry)} ÷ ${par(piv)} = ${fr(op.m)}.`;
    if (neg) why += ` Subtracting ${par(op.m)} × ${R(op.src)} is the same as adding ${one ? "" : fr(a) + " × "}${R(op.src)}.`;
    const extra = note ? `<p>(${note} already ${note.includes(" and ") ? "have" : "has"} a 0 in ${cn}: nothing to do there.)</p>` : "";
    const body = matrix(before, nLeft, mode, { chg: [op.target], src: op.src, pv: [op.src, op.col] }, "before")
      + arrow(`${neg ? "+" : "−"} ${mult}${R(op.src)}`)
      + matrix(after, nLeft, mode, { chg: [op.target], src: op.src, pv: [op.src, op.col], newc: [op.target, op.col] }, "after")
      + arithmetic(op, before, after, nLeft);
    return { title: `<span class="op">${opTxt}</span>`, text: `<p>${words}</p><p>${why}</p>${extra}`, body };
  }
  const p = op.pivot;
  const opTxt = `${R(op.row)} ← ${R(op.row)} ÷ ${par(p)}`;
  const inv = new Frac(p.d, p.n);
  let words = `Divide ${R(op.row)} by its pivot ${fr(p)}, so the pivot becomes 1.`;
  if (p.eq(Frac.of(-1))) words += ` (Dividing by −1 just changes every sign.)`;
  else if (!p.isInt()) words += ` Dividing by ${fr(p)} is the same as multiplying by ${fr(inv)}.`;
  const body = matrix(before, nLeft, mode, { chg: [op.row], pv: [op.row, op.col] }, "before")
    + arrow(`÷ ${par(p)}`)
    + matrix(after, nLeft, mode, { chg: [op.row], newc: [op.row, op.col] }, "after")
    + arithmetic(op, before, after, nLeft);
  return { title: `<span class="op">${opTxt}</span>`, text: `<p>${words}</p>`, body };
}

function view(s: Step, mode: Mode, n: number): View {
  const solve = mode === "solve";
  switch (s.phase) {
    case "start":
      return solve ? {
        title: "Start: the augmented matrix [A | b]",
        text: `<p>Each row is one equation; the column after the bar holds the right-hand sides. `
          + `Plan: make zeros <b>below</b> the diagonal (upper-triangular form), then solve from the bottom row up.</p>`,
        body: matrix(s.mat, n, mode) + equations(s.mat, n),
      } : {
        title: "Start: [A | I]",
        text: `<p>Write A and the identity matrix I side by side. Plan: row operations on whole rows until the `
          + `<b>left</b> half is I. The right half is then A⁻¹.</p>`
          + `<p>First make zeros below the diagonal, then make each pivot 1 and clear above it.</p>`,
        body: matrix(s.mat, n, mode),
      };
    case "op": return viewOp(s.op, s.before, s.mat, s.note, n, mode);
    case "nopivot":
      return {
        title: `${cap(colName(s.col, mode))}: no pivot`,
        text: `<p>${cap(colName(s.col, mode))} has only zeros in ${R(s.row)} and below, so there is no pivot to use here, `
          + `and no row swap can help.${s.col < n - 1 ? " Move on to the next column." : ""}</p>`
          + (solve ? "" : `<p>Without a pivot in every column, the left half can never become I.</p>`),
        body: matrix(s.mat, n, mode, { chg: rangeFrom(s.row, s.mat.length) }),
      };
    case "clear":
      return {
        title: `${cap(colName(s.col, mode))}: already done`,
        text: `<p>Every number below the pivot in ${colName(s.col, mode)} is already 0. Nothing to do; move on to the next column.</p>`,
        body: matrix(s.mat, n, mode, { pv: [s.row, s.col] }),
      };
    case "echelon":
      return solve ? {
        title: "Upper-triangular (row-echelon) form",
        text: `<p>${s.already ? "This system is already in this shape, so no row operations were needed. " : ""}`
          + `All numbers below the pivots are 0: a staircase. Written as equations again:</p>`,
        body: matrix(s.mat, n, mode, { }) + equations(s.mat, n),
      } : {
        title: "Zeros below the diagonal: now work upwards",
        text: `<p>${s.already ? "A already has zeros below the diagonal. " : ""}`
          + `From the bottom pivot up: divide its row by the pivot so the pivot is 1, then make zeros above it.</p>`,
        body: matrix(s.mat, n, mode),
      };
    case "back": {
      const b = s.sub, v = VARS[b.col], names = VARS;
      const row = s.mat[b.row];
      const lines: string[] = [`Row ${R(b.row)} says: ${lhs(row.slice(0, n), names)} = ${fr(b.rhs)}`];
      const pivTerm = (b.pivot.isOne() ? "" : b.pivot.eq(Frac.of(-1)) ? "−" : fr(b.pivot)) + v;
      if (b.known.length) {
        const vals = b.known.map(k => `${VARS[k.col]} = ${fr(k.value)}`).join(", ");
        let put = pivTerm;
        for (const k of b.known) {
          const neg = k.coef.sign() < 0, a = k.coef.abs();
          put += ` ${neg ? "−" : "+"} ${a.isOne() ? par(k.value) : fr(a) + "·" + par(k.value)}`;
        }
        lines.push(`Put in ${vals}: ${put} = ${fr(b.rhs)}`);
        let mv = fr(b.rhs);
        for (const k of b.known) {
          const p = k.coef.mul(k.value);
          if (!p.isZero()) mv += p.sign() > 0 ? ` − ${fr(p)}` : ` + ${fr(p.abs())}`;
        }
        lines.push(`Move the known numbers to the right: ${pivTerm} = ${mv} = ${fr(b.moved)}`);
      }
      if (b.pivot.isOne()) lines.push(`So <b>${v} = ${fr(b.value)}</b>.`);
      else lines.push(`Divide by ${par(b.pivot)}: <b>${v} = ${par(b.moved)} ÷ ${par(b.pivot)} = ${fr(b.value)}</b>`);
      const found = s.solved.map((x, k) => (x ? `${VARS[k]} = ${fr(x)}` : "")).filter(t => t).join(", ");
      return {
        title: `Back-substitution: find ${v}`,
        text: `<p>${lines.join("<br>")}</p><p class="qb-note">Known so far: ${found}</p>`,
        body: matrix(s.mat, n, mode, { chg: [b.row], pv: [b.row, b.col] }) + equations(s.mat, n, b.row),
      };
    }
    case "check": {
      const sol = s.x.map((x, k) => `${VARS[k]} = ${fr(x)}`).join(", ");
      const rows = s.checks.map(c => {
        const terms = c.coefs.map((a, k) => (a.isZero() ? "" : `${par(a)}·${par(s.x[k])}`)).filter(t => t);
        const ok = c.total.eq(c.rhs);
        return `${terms.length ? terms.join(" + ") : "0"} = `
          + (ok ? `<span class="ro-ok">${fr(c.total)} ✓</span>` : `${fr(c.total)} <span class="ro-no">≠ ${fr(c.rhs)}</span>`);
      });
      return {
        title: `Solution: ${sol}`,
        text: `<p>Check by putting the answer into the <b>original</b> equations:</p>`,
        body: `<div class="ro-eqs">${rows.map(r => `<div>${r}</div>`).join("")}</div>`,
      };
    }
    case "none": {
      const r = s.mat[s.row];
      return {
        title: `<span class="ro-no">No solution</span>`,
        text: `<p>Row ${R(s.row)} reads ${zeroLhs(n)} = ${fr(r[n])}, that is <b>0 = ${fr(r[n])}</b>. That is impossible: `
          + `no choice of ${VARS.slice(0, n).join(", ")} can make it true. So the system has <b>no solution</b>.</p>`
          + (n === 2 ? `<p>In a picture: the two lines are parallel and never meet.</p>` : ""),
        body: matrix(s.mat, n, mode, { bad: [s.row] }),
      };
    }
    case "infinite": {
      const zr = s.zeroRows.map(R).join(" and "), k = s.pivotCols.length;
      const free = s.free.map(c => VARS[c]), dep = s.pivotCols.map(c => VARS[c]);
      const ex = s.example.map((x, c) => `${VARS[c]} = ${fr(x)}`);
      const fx = s.free.map(c => `${VARS[c]} = 0`).join(", ");
      return {
        title: `<span class="ro-ok">Infinitely many solutions</span>`,
        text: `<p>${zr} ${s.zeroRows.length > 1 ? "read" : "reads"} ${zeroLhs(n)} = 0, that is <b>0 = 0</b>: always true, `
          + `so it tells us nothing. That leaves ${k} equation${k > 1 ? "s" : ""} for ${n} unknowns.</p>`
          + `<p>${list(free)} ${free.length > 1 ? "have" : "has"} no pivot, so ${free.length > 1 ? "they are" : "it is"} <b>free</b>: `
          + `pick any value, and back-substitution gives ${list(dep)}. Every choice is a solution.</p>`
          + `<p>Example: ${fx} gives ${ex.filter((_, c) => !s.free.includes(c)).join(", ")}.</p>`,
        body: matrix(s.mat, n, mode, { chg: s.zeroRows }),
      };
    }
    case "singular":
      return {
        title: `<span class="ro-no">No inverse</span>`,
        text: `<p>Row ${s.zeroRows.map(R).join(" and ")} has <b>only zeros on the left</b>. A row of zeros can never `
          + `be turned into a row of I (it would need a 1), so A has <b>no inverse</b>: A is singular.</p>`
          + `<p>The reason: ${n === 2 ? "one row of A is a multiple of the other" : "one row of A is a combination of the others"}.</p>`,
        body: matrix(s.mat, n, mode, { bad: s.zeroRows }),
      };
    case "identity":
      return {
        title: "Done: the left half is I",
        text: `<p>The left half has become the identity matrix, so the right half is the inverse A⁻¹.</p>`,
        body: matrix(s.mat, n, mode, { inv: true }) + arrow("") + `<div><div class="ro-cap">A⁻¹</div>${plain(s.inv)}</div>`,
      };
    case "invcheck": {
      const isI = s.prod.every((r, i) => r.every((v, j) => v.eq(Frac.of(i === j ? 1 : 0))));
      const entry = (i: number, j: number) => s.A[i].map((a, k) => `${par(a)}·${par(s.inv[k][j])}`).join(" + ")
        + ` = ${fr(s.prod[i][j])}`;
      return {
        title: `Check: A · A⁻¹ = I ${isI ? '<span class="ro-ok">✓</span>' : '<span class="ro-no">✗</span>'}`,
        text: `<p>Multiply A by the result: row of A times column of A⁻¹. For example</p>`
          + `<div class="ro-eqs"><div>row 1 · column 1: ${entry(0, 0)}</div><div>row 1 · column 2: ${entry(0, 1)}</div></div>`,
        body: `<div><div class="ro-cap">A</div>${plain(s.A)}</div><b>·</b><div><div class="ro-cap">A⁻¹</div>${plain(s.inv)}</div>`
          + `<b>=</b><div><div class="ro-cap">I</div>${plain(s.prod)}</div>`,
      };
    }
  }
}

function plain(m: M): string {
  return matrix(m, m[0].length, "inverse").replace(/<td class="rl">R\d<\/td>/g, "");
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rangeFrom = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

// ---------------------------------------------------------------- the widget

const DEFAULTS: Record<Mode, Record<number, { a: number[]; b: number[] }>> = {
  solve: {
    2: { a: [2, 1, 1, 3], b: [8, 9] },
    3: { a: [1, 1, 1, 0, 2, 1, 2, 1, 1], b: [6, 7, 8] },
    4: { a: [1, 1, 0, 1, 2, 3, 1, 2, -1, 0, 2, 1, 0, 2, 1, 3], b: [6, 15, 4, 14] },
  },
  inverse: {
    2: { a: [2, 1, 1, 3], b: [] },
    3: { a: [1, 1, 0, 2, 3, 1, 0, 1, 2], b: [] },
    4: { a: [1, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2], b: [] },
  },
};

/** Mount a row-operation stepper. data-a = n×n numbers (row by row), data-b = n numbers (solve only). */
export function mountRowOps(host: HTMLElement, mode: Mode): void {
  injectStyle();
  host.classList.add("ro");
  const solve = mode === "solve";
  const r = rng(Number(host.dataset.seed ?? 1));

  const parseList = (s: string | undefined) => (s ?? "").trim().split(/[\s,]+/).filter(t => t).map(parseFrac);
  const presetA = parseList(host.dataset.a), presetB = parseList(host.dataset.b);
  let presetN = Math.round(Math.sqrt(presetA.length));
  const presetOk = presetA.length > 0 && presetN >= 2 && presetN <= 4 && presetN * presetN === presetA.length
    && presetA.every(v => v) && (!solve || (presetB.length === presetN && presetB.every(v => v)));
  if (!presetOk) presetN = 3;

  let n = presetN;
  let A: string[][] = [], b: string[] = [];
  let steps: Step[] = [], cur = 0, showAll = false;

  const left = htmlEl("div", "ro-left", "", host);
  const right = htmlEl("div", "ro-right", "", host);

  htmlEl("div", "qb-note", solve ? "The system [A | b] (type numbers, e.g. 3, −2, 1/3):" : "The matrix A (type numbers, e.g. 3, −2, 1/3):", left);
  const sizeRow = htmlEl("div", "qb-presets", "", left);
  const sizeBtns = [2, 3, 4].map(k => button(sizeRow, `${k}×${k}`, () => { n = k; loadDefault(); }));
  const grid = htmlEl("div", "ro-in", "", left);
  const err = htmlEl("div", "ro-err", "", left);
  htmlEl("div", "qb-note", "New random example:", left);
  const rnd = htmlEl("div", "qb-presets", "", left);
  const kinds: [string, Kind][] = solve
    ? [["one solution", "unique"], ["needs a swap", "swap"], ["no solution", "none"], ["infinitely many", "infinite"]]
    : [["invertible", "unique"], ["needs a swap", "swap"], ["no inverse", "none"]];
  for (const [label, kind] of kinds) button(rnd, label, () => randomize(kind));
  const resetRow = htmlEl("div", "qb-presets", "", left);
  button(resetRow, "reset", () => { n = presetN; loadPreset(); });

  const nav = htmlEl("div", "ro-nav", "", right);
  const bBack = button(nav, "◀ back", () => go(cur - 1));
  const bNext = button(nav, "next ▶", () => go(cur + 1));
  const bAll = button(nav, "show all steps", () => { showAll = !showAll; draw(); });
  const count = htmlEl("span", "ro-count", "", nav);
  const stage = htmlEl("div", "", "", right);

  function loadPreset(): void {
    if (!presetOk) { loadDefault(); return; }
    A = rows(presetA.map(v => v!.toString().replace("−", "-")), n);
    b = presetB.map(v => v!.toString().replace("−", "-"));
    rebuild();
  }
  function loadDefault(): void {
    const d = DEFAULTS[mode][n];
    A = rows(d.a.map(String), n); b = d.b.map(String);
    rebuild();
  }
  function randomize(kind: Kind): void {
    if (solve) {
      const s = randomSystem(n, kind, r.unif);
      A = s.A.map(row => row.map(String)); b = s.b.map(String);
    } else {
      A = randomInvertible(n, kind === "infinite" ? "none" : kind as "unique" | "swap" | "none", r.unif).map(row => row.map(String));
    }
    rebuild();
  }

  /** Rebuild the input grid for the current size and values, then recompute. */
  function rebuild(): void {
    sizeBtns.forEach((x, k) => x.classList.toggle("active", k + 2 === n));
    grid.innerHTML = "";
    const cols = solve ? n + 2 : n;   // solve: n inputs, a bar, the b input
    grid.style.gridTemplateColumns = solve ? `repeat(${n}, auto) 2px auto` : `repeat(${n}, auto)`;
    if (solve) {
      for (let j = 0; j < cols; j++) htmlEl("span", "h", j < n ? VARS[j] : j === n ? "" : "b", grid);
    }
    const mk = (get: () => string, set: (v: string) => void) => {
      const inp = htmlEl("input", "", "", grid);
      inp.type = "text"; inp.inputMode = "text"; inp.value = get(); inp.spellcheck = false;
      inp.addEventListener("input", () => { set(inp.value); compute(); });
      inp.addEventListener("change", () => inp.blur());
      inp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") inp.blur(); });
      return inp;
    };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) mk(() => A[i][j], v => { A[i][j] = v; });
      if (solve) { htmlEl("span", "bar", "", grid); mk(() => b[i], v => { b[i] = v; }); }
    }
    compute();
  }

  function compute(): void {
    const inputs = Array.from(grid.querySelectorAll("input"));
    const vals = (solve ? A.map((row, i) => [...row, b[i]]) : A).flat();
    let okAll = true;
    const parsed = vals.map((s, k) => {
      const f = parseFrac(s);
      inputs[k].classList.toggle("bad", !f);
      if (!f) okAll = false;
      return f;
    });
    if (!okAll) { err.textContent = "Some entries are not numbers (red)."; return; }
    err.textContent = "";
    const w = solve ? n + 1 : n;
    const Mx: M = Array.from({ length: n }, (_, i) => parsed.slice(i * w, i * w + n) as Frac[]);
    steps = solve ? solveSteps(Mx, Array.from({ length: n }, (_, i) => parsed[i * w + n] as Frac)) : inverseSteps(Mx);
    cur = 0;
    draw();
  }

  function go(k: number): void {
    cur = Math.max(0, Math.min(steps.length - 1, k));
    draw();
  }

  function card(k: number): string {
    const v = view(steps[k], mode, n);
    const st = steps[k];
    const key = st.phase === "op" ? KEY_OP : "";
    return `<div class="ro-title">${showAll ? `${k + 1}. ` : ""}${v.title}</div><div class="ro-text">${v.text}</div>`
      + `<div class="ro-body">${v.body}</div>${key}`;
  }

  function draw(): void {
    if (!steps.length) return;
    bBack.disabled = showAll || cur === 0;
    bNext.disabled = showAll || cur === steps.length - 1;
    bAll.textContent = showAll ? "one step at a time" : "show all steps";
    count.textContent = showAll ? `${steps.length} steps` : `step ${cur + 1} of ${steps.length}`;
    if (showAll) stage.innerHTML = `<div class="ro-all">${steps.map((_, k) => `<div class="ro-card">${card(k)}</div>`).join("")}</div>`;
    else stage.innerHTML = `<div class="ro-all" style="max-height:none;overflow:visible">${card(cur)}</div>`;
  }

  loadPreset();
}

function rows(flat: string[], n: number): string[][] {
  return Array.from({ length: n }, (_, i) => flat.slice(i * n, i * n + n));
}

