# Matrix transforms on images — extension plan

Tracker for adding a worked example where 2×2 matrices are applied to an image,
following on from `matrix-transforms/`. Tick boxes as you go.

> Internal planning doc. It lives in `plan/`, so it stays off the public site.

**Status (2026-10-14): implemented as a separate unit, `matrix-images/`
("Transforming images with matrices").** Remaining: the code audit flagged in
`CODE_AUDIT_CHECKLIST.md`.

### Restructure (2026-10-14)

The plan first added the image material *into* `matrix-transforms/`, which grew that deck
from 13 to 20 content slides. Following the new deck-size rule (design principle 7, "Keep
slide decks small — split, don't cut": each deck is recorded as a video, so decks should be
suitably sized, self-contained snippets), the image material became **its own unit**,
placed right after *Matrices as transformations* in the sidebar:

| Unit | Deck | Exercise |
|---|---|---|
| `matrix-transforms/` (unchanged, apart from a pointer) | original 13 content slides; the Summary's "Next" now points to the image unit | original + by-hand **B7** (rotate then flip, as one matrix) + a reflection row in Background |
| `matrix-images/` (new) | 9 content slides: About, image as points, rotating, shear, gallery, order matters, pipeline, undoing a misalignment, Summary | by hand **B1** (shear); **R1–R5** on the image; hints 1–2; solutions; Where this leads |

Figures moved with it and were renumbered to the new deck's slide numbers (`fig02`…`fig09`).
Nothing was cut: the "order matters on an image" slide that had been removed to save space
is back as a slide in the new deck.

### Implementation notes

- Figures draw each pixel as its unit square mapped through `A` (a parallelogram), so they
  have no holes at any zoom; the student code plots plain `pch = 15` points, which looks
  the same at normal size. A singular `A` is drawn as points so the collapsed line is visible.
- `msc-small.jpg` is 120 × 160 px, block-averaged 15 × 15 and contrast-stretched to 0..1.
- `jpeg` added to `intro/install.qmd`; `make figs` re-generates the figures.
- R5 (formerly R9) asks about pixel spacing rather than plotting the scaled-down image,
  because whether holes show on screen depends on the zoom and marker size.

## Why

*Matrices as transformations* teaches identity, scaling, rotation and composition on a
handful of points (a square). Applying the same matrices to an image:

- makes each transformation visible at a glance: thousands of points moving together instead of four,
- motivates **matrix–matrix multiplication**. A pipeline (rotate → skew → resize) can be
  multiplied into **one** matrix and applied to every pixel once, and the order of the
  factors visibly changes the result,
- adds transformations the course was missing: **shear/skew**, along with reflection and
  a singular (collapsing) matrix,
- gives a biology pairing (design principle 1): **image registration**. A tissue section or
  a second imaging round comes out rotated, scaled or skewed relative to the first (H&E vs
  spatial-transcriptomics spot grid, repeated FISH rounds, a slide placed crooked). Aligning
  them means finding and applying a matrix.

## Core technique (fixed)

Pixels as a 2 × N coordinate matrix, transformed by one `%*%`, plotted as points
in their original colours. This is forward mapping in base R plus `jpeg`:

```r
img <- jpeg::readJPEG("msc-small.jpg")            # greyscale matrix, values 0..1
img <- t(img[nrow(img):1, ])                      # image rows count from the top: flip so up is up
xy  <- t(expand.grid(1:nrow(img), 1:ncol(img)))   # 2 x N, same order as as.vector(img)
col <- gray(img)
plot(t(A %*% xy), col = col, pch = 15, asp = 1)
```

It follows the convention from *Matrices as transformations* ("samples as columns, `t()` for
plotting"). We deliberately skip interpolation and resampling (inverse mapping). They only come
up in the gap artefact discussed below.

## Decisions

- [x] **Image source (decided 2026-10-14).** The transmission electron micrograph of a
  mesenchymal stem cell,
  <https://upload.wikimedia.org/wikipedia/commons/5/52/MSC_high_magnification.jpg>
  ([file page](https://commons.wikimedia.org/wiki/File:MSC_high_magnification.jpg)).
  - Licence **CC BY 3.0**, author **Robert M. Hunt**. Attribution is required: a credit line
    on every slide that shows the image, in the exercise, and printed on every figure.
  - The original is 1803 × 2400 px (1.7 MB). It is downloaded by the figure script and
    gitignored; only the downsampled `matrix-images/msc-small.jpg` (13 kB) is committed.
  - The image is asymmetric (an irregular cell body with processes), so rotation, reflection and
    shear are unambiguous. Biology hook: a TEM section is cut and mounted at an arbitrary
    angle, so the same cell imaged twice will not line up.
  - Students download `msc-small.jpg` via a link in the exercise and on the first image slide;
    the link is what makes Quarto copy it into `docs/`.
- [x] **No landmarks (decided 2026-10-14).** The misalignment matrix `A` is given; estimating it
  from the images is out of scope.
- [x] **Figure format.** PNG generated by an R script (an SVG with ~19 000 pixel marks would be
  heavy); the rest of the course keeps its hand-drawn SVGs.
- [x] **Figure naming.** `figNN-*.png`, numbered by the slide of the new deck they appear on.
- [x] **Deck size (decided 2026-10-14).** Split into a separate unit instead of growing or cutting
  `matrix-transforms` (design principle 7). The old timing check against `timeplan_by_day.md` is
  **n/a**: the user said to disregard the timeplan, because the course is being refactored, and
  which day a deck lands on is decided later.

## 1. Figure generation script

- [x] `matrix-images/make-image-figs.R` (run with `make figs`): downloads the original image if it
  is not present, writes `msc-small.jpg`, defines `rot()` and `shear()`, and writes every PNG below
  (fixed size, `asp = 1`, shared axis limits within a figure, a dashed outline of the original
  image frame, origin marked, and the CC BY credit printed on the figure).
- [x] Comment at the top says it is re-run by hand (not by `quarto render`).

### Figures (all in `matrix-images/`)

| File | Content | Used on |
|---|---|---|
| [x] `fig02-image-as-points.png` | Image → zoomed-in pixel grid → the 2×N coordinate matrix | lec, "An image is a matrix of points" |
| [x] `fig03-image-rotation.png` | Original vs rotated 30° | lec, "Rotating an image" |
| [x] `fig04-shear-axes.png` | Shear with the images of the unit axes drawn as labelled arrows (columns = where the axes land) | lec, "Shear: read it from the columns" |
| [x] `fig05-image-gallery.png` | 2×3 grid: identity, scale `diag(c(2,.5))`, shear, rotation, reflection, singular | lec, "A gallery of 2 × 2 matrices" |
| [x] `fig06-image-order.png` | Rotate-then-shear vs shear-then-rotate (AB ≠ BA, made visible) | lec, "Order matters — on an image"; exercise R3 solution |
| [x] `fig07-image-pipeline.png` | Original → rotate → shear → resize, ending in the single product matrix `M = S H R` | lec, "Why multiply matrices?" |
| [x] `fig08-registration.png` | The same cell "imaged twice": reference, misaligned copy (known `A`), restored with `solve(A)` | lec, "Biology: undoing a misalignment" |
| [x] `fig09-gap-artefact.png` | Scaling up by 3 leaves holes between pixels (forward mapping) | exercise R5 solution |

## 2. Lecture (`matrix-images/lec.qmd`)

Every slide has a `::: notes` block, matching the existing decks.

- [x] **About this lecture**: what's new compared with *Matrices as transformations*, plus `install.packages("jpeg")`.
- [x] **An image is a matrix of points**: setup code (read, flip, `xy`, `col`, plot). Fig 02.
- [x] **Rotating an image**: the rotation matrix from *Matrices as transformations* applied to all
  pixels in one `%*%`. Fig 03.
- [x] **Shear: read it from the columns**: `H = [1, 0.5; 0, 1]`; the columns are where the axes land. Fig 04.
- [x] **A gallery of 2 × 2 matrices**: reflection, singular, and the `det` area preview as one
  bullet (more in *Eigenvalues & eigenvectors*). Fig 05.
- [x] **Order matters — on an image**: `H %*% R` vs `R %*% H`. Fig 06.
- [x] **Why multiply matrices? A pipeline in one step**: three passes vs one product matrix,
  `all.equal()` check, cost argument. Fig 07.
- [x] **Biology: undoing a misalignment**: known `A`, `solve(A)` (link to *Linear systems in R*). Fig 08.
- [x] **Summary** table, and **Next:** *Eigenvalues & eigenvectors*.
- [x] `matrix-transforms/lec.qmd` restored to its original slides; its Summary's "Next" line points to
  this unit first.

## 3. Exercise (`matrix-images/exercise.qmd`)

Core exercises only, without long stretch tails (design principle 3).

- [x] **Background:** rotation, shear, reflection and scaling matrices; "columns are where the axes
  land"; pipeline order.
- [x] **In R** setup block: a link to `msc-small.jpg`, the CC BY credit, read/flip/`xy`/`col`, and `rot()` / `shear()`.
- [x] **B1 (by hand).** Shear `[1, 2; 0, 1]`: where do the axes land? Apply it to the unit square.
- [x] **R1.** Rotate by 30° then −30°; confirm you are back at the original; `rot(-pi/6) %*% rot(pi/6)` is the identity.
- [x] **R2.** Your own gallery (scale, shear, reflection, singular): predict from the columns first; which cannot be undone?
- [x] **R3.** The pipeline as one matrix `M`; check with `all.equal`; reverse the order and compare (Fig 06 in the solution).
- [x] **R4.** Undo a known misalignment with `solve(A)`; check `solve(A) %*% A` is the identity.
- [x] **R5.** Scale by 3 (`big <- diag(c(3, 3)) %*% xy`), zoom in, describe the holes; reason about
  pixel spacing before and after, and for scaling down (Fig 09 in the solution).
- [x] Hints (plotting a transformed image; undoing with `solve`) and full solutions, in the existing callout style.
- [x] **Where this leads:** eigenvectors (under the shear the x-axis stays put), inverse mapping and
  interpolation, translations and homogeneous 3×3 coordinates, Fourier for images.
- [x] `matrix-transforms/exercise.qmd`: by-hand **B7** (rotate then flip → swaps x and y) and a pointer to this unit.

## 4. Consistency and QA

- [x] `rot()` uses the same `byrow = TRUE` form in the lecture, the exercise and the script.
- [x] Every R chunk of the new lecture and exercise, run in order in a fresh `Rscript --vanilla`
  session: no errors, and the numbers quoted in the text match (e.g. `max(abs(...))` ≈ 3e-14,
  `det(A) = 1.11`, `M = [1.67, -0.1; 0.37, 0.65]`).
- [x] Attribution present on every slide and figure that shows the image, and in the exercise.
- [x] Full `make render` (refreshes `docs/search.json`; it now indexes `matrix-images`). All 9 slides
  checked at 1280×720 with headless Chrome screenshots. The shear slide overflowed (Quarto's
  `r-stretch`), which `.nostretch` fixed; one Summary code cell was shortened so it fits on one line.
- [x] Every figure checked against `plan/figure-qa-checklist.md`. Sections A–F apply to these PNGs;
  G (cairosvg/XML) is SVG-only. Found and fixed: no axis titles (B), so `x`/`y` were added and the
  margins widened so they clear the tick labels and the bottom edge; unlabelled arrows in the shear
  figure (D) now have boxed `(1, 0)` / `(0, 1)` / `(0.5, 1)` labels, kept off the busy texture and
  the canvas edge; empty bands in the text panel of fig 02 (A) were removed with larger text;
  gallery titles were too small after `mfrow` shrinking (C) and were enlarged; the singular-matrix
  line was nearly invisible and is now drawn as points. Remaining whitespace below the images is
  deliberate, because panels in a figure share axis limits so they can be compared.
- [x] `CODE_AUDIT_CHECKLIST.md`: `matrix-images` lec, exercise and script, plus
  `matrix-transforms/exercise.qmd` and `Makefile`, are listed as needing audit.
- [x] Cross-links in the speaker notes of `eigen/lec.qmd` and `pca/lec.qmd` point to *Transforming images with matrices*.
- [x] Sidebar entry in `_quarto.yml`, right after *Matrices as transformations*.
- [x] `git add` (no commit).

## Open questions

- None at the moment.
