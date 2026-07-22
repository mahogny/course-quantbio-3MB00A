# Figure QA checklist (SVG lecture diagrams)

Audit **one figure at a time**. Render it with cairosvg at high resolution
(`--output-width 1100`) and read the PNG, then check every item below. Note the
row/coordinate of each defect, fix it in the SVG source, **re-render and re-check**.
Do not mark a figure done until every box passes on a fresh render.

> cairosvg ≠ the browser (different fonts/metrics). Treat glyph-level and tight
> spacing findings as indicative; leave a small safety margin rather than
> pixel-fitting to cairo's metrics.

## ★ Headline rule — no overlap when there is space
**Nothing may overlap text if free canvas exists to avoid it.** Arrow shafts and
arrowheads must not pass through or land on a label; callout/legend boxes must not
sit on top of text; leader lines and gridlines must route *around* text, not
through it; two labels must not touch. If the canvas has room (and it almost
always does — see the wasted-space checks), **move the offending element, or move
the label, into that space.** Only an unavoidable overlap on a genuinely full
canvas is acceptable — and even then, prefer reflowing/resizing to eliminate it.
(fig03: red arrow crosses "per FEATURE"; dashed arrow runs into "feature
contributions". fig02: arrowhead pierces the "40 samples (rows)" label.)

## A. Canvas & space
- [ ] Outer margins small and even (~2–3% each side); nothing touches/clips the edge.
- [ ] **No large INTERNAL empty band** — no big white gap between plot and caption,
      legend, or title. Every sizeable empty region must be justified.
- [ ] Caption/subtitle sits **close to** the content it follows, not pinned to a
      far edge. (fig14: caption at y=405 with plot ending y=336 → gap.)
- [ ] Aspect ratio fits the content; figure is not taller/wider than it needs to be.

## B. Axes (for any plot)
- [ ] x-axis title centred **on the axis span**, below the tick labels, not overlapping them.
- [ ] y-axis title centred along the axis length, rotated, clear of the tick numbers
      (no collision, no excessive gap).
- [ ] Tick labels aligned to their ticks (centred on each tick), evenly spaced.
- [ ] Tick labels don't collide with the axis line, each other, or the data.
- [ ] Scale is linear & consistent: equal value steps = equal pixel steps.
- [ ] Axis range actually covers the plotted data (no marks outside the axes).

## C. Text placement
- [ ] No overlapping or colliding text anywhere.
- [ ] **No arrow / box / line / data-mark overlaps any text when space exists to
      avoid it** (see headline rule). Nudge the label or the element into free space.
- [ ] Every label is **adjacent to and clearly tied to** its target — no floating,
      disconnected labels.
- [ ] Text does not cross a line/arrow/shape it isn't meant to.
- [ ] No text clipped at any edge.
- [ ] Font sizes consistent and legible (body labels ≥12px at native scale).

## D. Arrows & connectors
- [ ] Arrow **tip lands exactly on** its target (touching the marker/curve/box),
      not merely near it. (fig14: tip at (352,80) vs curve point (348,82).)
- [ ] Arrow **start originates at** the label/text it belongs to, not blank space.
- [ ] No arrow points into empty space.
- [ ] Each leader connects the correct label to the correct object.

## E. Legend
- [ ] Legend placed in a sensible, **aligned** spot (a corner or a dedicated column),
      not floating in mid-whitespace.
- [ ] Legend aligned to a consistent edge/grid with any other margin elements.
- [ ] Swatch colours **exactly match** the series they denote.
- [ ] Legend fully inside the canvas; not clipped; not overlapping data/labels.

## F. Notation & semantics
- [ ] Superscripts/subscripts shown **as** super/subscripts (use an SVG `<tspan>`
      with `baseline-shift`/`dy` + smaller font, e.g. R²Y, Q², λ₁) — verify it
      renders in cairosvg. Only fall back to ASCII `^`/`_` if cairo mangles it,
      and note it. **Never** a raw Unicode super/subscript char (drops to a blank).
- [ ] Notation matches the slide prose (slide uses `$R^2$` → figure shows R², not R2).
- [ ] Symbols consistent across the whole figure.
- [ ] Data marks match the described values/relationships.
- [ ] series colour = its label colour = its legend swatch (consistent colour coding).

## G. Render & finish
- [ ] Rendered with cairosvg at ≥1100px and inspected; no dropped glyphs (blank gaps).
- [ ] Well-formed XML; marker `orient="auto"`; no `--` inside `<!-- comments -->`.
- [ ] Re-rendered after every edit and re-checked A–F.

---

### Worked example — `opls/fig14-r2-q2-curves.svg` defects found
| Item | Defect | Fix |
|------|--------|-----|
| D | R2Y arrow tip (352,80) misses curve point (348,82); starts in blank space | anchor tip on the marker; start at the R2Y label |
| E | right-hand legend + "overfitting" text float, unaligned | align to a common x, group as one panel |
| A | caption pinned at y=405, ~70px dead band above it | move caption up; shrink canvas height |
| B | x-title centred on axis (x=309) reads off-centre vs full width; y-title near ticks | keep on-axis but verify clearance |
| F | `R2Y`, `Q2`, `R2` instead of R², Q² | tspan superscripts |

### Worked example — `opls/fig03-pca-factorization.svg`
| Item | Defect | Fix |
|------|--------|-----|
| ★/C | red down-arrow crosses the word "per FEATURE" | shorten arrow / move label clear |
| ★/C | dashed curved leader runs into "feature contributions" | reroute leader below the text |
| A | large dead band above the bottom "Unsupervised…" box | move box up, shrink height |

### Worked example — `opls/fig02-metabolomics-data-matrix.svg`
| Item | Defect | Fix |
|------|--------|-----|
| ★/D | arrowhead pierces the rotated "40 samples (rows)" label | stop arrow before the label / shift label |
| A | dead band above the italic bottom caption | move caption up |
