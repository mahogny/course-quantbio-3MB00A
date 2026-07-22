# Course restructure & build-out plan — 3MB00A

Working tracker for (1) renaming files off the day/week scheme, (2) building the
remaining course blocks, and (3) adding explanatory figures. Tick boxes as you go.

> Internal planning doc — lives in `plan/` so it is **not** matched by the
> `_quarto.yml` render globs and stays off the public site.

## Decisions (locked 2026-07-21)

- **Naming:** flat topic slugs — one folder per teaching unit, kebab-case topic
  name, **no day/week/number in the name**.
- **Ordering:** sequence lives **only** in `_quarto.yml` (sidebar `contents:`
  order) and `index.qmd`. Reordering = edit those, never rename a folder.
- **Day references:** rewrite the in-content "Day N" subtitles and cross-refs to
  **topic-based** wording (survives reordering).
- **Scope:** build **all four** remaining blocks (Applications, Bayesian,
  Penalized, Single-cell). The two `[?]` blocks are provisional (may migrate to a
  later stats/ML course) but are self-contained folders, so easy to lift out.

## Naming convention (the rules)

- Each unit folder holds: `lec.qmd` (reveal.js slides), `exercise.qmd`, an
  optional `quiz.qmd`, and its own `figNN-*.svg` files.
- **Keep the base filenames** `lec` / `exercise` / `quiz` — `styles.css` colours
  sidebar leaves by these substrings (lec → green, quiz → blue, exercise → italic).
- Folders stay **one level deep** (like the old `dayN/`) so `../theme.scss` and
  `../styles.css` in each lec header keep resolving. Do **not** nest into block
  subfolders.
- Figures use **relative** refs (`![](figNN-...svg)`), so they travel with the
  folder on a `git mv` — no image-path edits needed.
- Warm-ups stay as one ordered unit `warmups/` (the `01`–`09` drills are an
  intrinsic teaching sequence within a single unit, not day-shuffling).

---

## Phase 0 — Rename the existing linear-algebra units  *(mechanical, low risk)*

`git mv dayN → <slug>`. Verified: **no** hardcoded `dayN/` paths exist outside
`_quarto.yml` (checked `index.qmd` + all root `*.md`), so only the sidebar needs
path edits.

| current | new slug | title (sidebar) | files |
|--------|----------|-----------------|-------|
| `day0` | `warmups` | Matrix warm-ups (01–09) | 9 drills |
| `day1` | `solving-systems` | Linear systems by hand | lec, quiz, exercise |
| `day2` | `solving-systems-r` | Linear systems in R | lec, exercise |
| `day3` | `vectors-projection` | Vectors, dot product, projection | lec, quiz, exercise |
| `day4` | `matrix-transforms` | Matrices as transformations | lec, exercise |
| `day5` | `eigen` | Eigenvalues & eigenvectors | lec, quiz, exercise |
| `day6` | `eigen-r` | Eigenvalues in R | lec, exercise |
| `day7` | `markov` | Markov chains | lec, quiz, exercise |
| `day8` | `markov-r` | Markov chains in R | lec, exercise |
| `day9` | `hmm` | Hidden Markov models | lec, quiz, exercise |
| `day10` | `hmm-r` | Fitting HMMs in R | lec, exercise |

Tasks:

- [x] `git mv` all 11 folders to their slugs
- [x] Update `_quarto.yml` sidebar `hrefs` + render globs (dropped dead `day*/`
      globs → `*/*.qmd`; added `!plan/` so internal docs stay off the site;
      section header now "Linear algebra", sub-sections use topic titles)
- [x] `index.qmd` "before day 1" → "before you start the first unit"
- [x] confirmed only `docs/` (regenerated) referenced old paths; stale
      `docs/dayN` dirs removed
- [x] Rebuilt `docs/`; all 11 units render, 79 SVGs embedded, sidebar correct

## Phase 1 — Rewrite in-content "Day N" references  *(done)*

- [x] lec subtitles → `subtitle: "Linear algebra — <topic>"`
- [x] Body / exercise / quiz cross-refs ("recall Day 6", "Recap (Day 7)") →
      topic-named (85 occurrences across 22 files)
- [x] **Also** reworded 80 relative-schedule refs ("yesterday/tomorrow/next
      week") to topic names — they break under reordering just like "Day N"
- [x] Re-rendered; `grep -nE 'day[- ]?[0-9]+'` and adjacency-word scan → zero
      content hits (calendar docs like `timeplan_by_day.md` keep day numbers)

---

## Phase 2 — Build the remaining blocks  *(content + slides)*

Per new unit, produce: `lec.qmd` (reveal.js; copy the YAML header from an existing
lec so theme/format match), `exercise.qmd`, and `quiz.qmd` for concept units.
**Figures come after (Phase 3), once slides exist.**

> ⚠️ Generated drafts are first drafts — flag each for subject-matter review
> before it is taught. Accuracy of biology/stats claims is not guaranteed by the
> generator.

### Block 2 — Applications  *(~8 units)*

- [ ] `pca` — PCA: the idea (variance maximization, latent space, projection recap)
- [ ] `pca-r` — computing PCA in R (`prcomp`/SVD; scores & loadings)
- [ ] `pca-scree` — scree plots, choosing #components, data reduction, pitfalls; ICA teaser
- [ ] `opls` — the OPLS model (supervised latent variables)
- [ ] `multiome` — multiome integration (RNA-seq vs proteomics); interpretation
- [ ] `chemometrics-1` — chemometrics foundations
- [ ] `chemometrics-2` — chemometrics applications  · **[?] needs a domain contributor**
- [ ] `fourier` — Fourier transform / alternative basis functions for image analysis

### Block 3 — Bayesian statistics  *(~7 units) · **[?]** provisional*

- [ ] `bayes-intro` — Bayesian vs frequentist; prior, likelihood, posterior
- [ ] `rstan-intro` — introduction to R-STAN (mechanics)
- [ ] `bayes-fitting` — fitting equations / regression in STAN
- [ ] `error-models` — error models: exponential & Poisson distributions
- [ ] `covariates` — handling covariates (age, sex, BMI, treatment)
- [ ] `hierarchical` — hierarchical models; biological vs technical replicates
- [ ] `bayes-case` — worked integrative biological case

### Block 4 — Penalized linear models  *(~5 units) · **[?]** provisional*

- [ ] `penalized-intro` — why penalize; overfitting & identifiability
- [ ] `ridge-lasso-enet` — L1, L2, elastic net
- [ ] `penalty-bayes-link` — connection to Bayesian priors (MAP view)
- [ ] `crossval` — cross-validation & model selection
- [ ] `penalized-case` — case analysis; identifiability pitfalls

### Block 5 — Single-cell analysis  *(~4 units)*

- [ ] `scrna-intro` — the topic + basic preprocessing / QC
- [ ] `scrna-umap` — UMAP & clustering
- [ ] `scrna-annotation` — interpretation & cell-type annotation
- [ ] `scrna-cellcycle` — cell-cycle analysis; connection to PCA

### Revision + exam  *(~2 units)*

- [ ] `revision` — revision & practice across blocks
- [ ] `exam` — mock / prep for the on-campus written exam (optional)

For each block: add its units to `_quarto.yml` (new section) + `index.qmd`, then
rebuild `docs/`.

> **Status 2026-07-21:** all 24 units authored (lec + exercise, 14 with quiz),
> all static-R (no runtime deps), all rendering; wired into the sidebar in
> syllabus order (Applications → Bayesian → Penalized → Single-cell). Authors
> left `<!-- FIGURE: ... -->` hints for the figure pass. Each unit carries a
> reviewer note (see workflow journals) — **all need SME review before teaching**;
> the provisional blocks carry an in-slide callout.

---

## Phase 3 — Figure evaluation & SVG generation  *(per block, after its slides)*

Reuse the proven 4-wave parallel workflow (already built and validated on the
linear-algebra block this session):

1. **Evaluate** — one worker per deck decides, slide by slide, whether an
   explanatory figure is motivated; assigns a filename + diagram brief, or records
   why none is needed.
2. **Draw** — one worker per figure writes a self-contained SVG against the shared
   style guide (consistent palette #1b2a3a / #2a6f97 / #bc4749 / #6a994e, sans
   fonts, transparent bg, ≤900×420).
3. **Wire** — one worker per deck inserts the `![]()` refs (centered or two-column).
4. **Visual QA** — one worker per deck rasterizes each SVG, *looks* at it, and
   repairs text overlap / clipping / dropped-glyph bugs.

Gates before a block is "done":

- [x] every SVG is well-formed XML (`xmllint`) — 256 new SVGs all valid
- [x] no `orient="auto-start-end"` (normalised to `orient="auto"`)
- [x] every deck renders with images embedded and copied to `docs/`
- [x] browser-accurate QA pass (cairosvg) — 24 decks inspected & repaired; the
      common bugs were dropped Unicode glyphs (subscripts, ‖, ≫, ᵀ → ASCII) and
      `tspan` overlaps, exactly as on the linalg block
- [x] svg/ref parity per deck verified

> **Status 2026-07-22:** Phase 3 complete for all 24 new decks — evaluate → draw
> → wire → visual-QA (≈340 agent-runs). **256 figures** added.
> One incident: a draw worker overwrote `hierarchical/lec.qmd` with an SVG; the
> deck was restored from the Phase 2 authoring transcript and its figures
> regenerated cleanly. A full scan confirmed no other deck was clobbered.

---

## Suggested execution order

1. Phase 0 (rename) → Phase 1 (reference rewrite) → rebuild & sanity-check. Small,
   fast, unblocks everything and de-risks the current content.
2. Block 5 (Single-cell, 4 units) or Block 2 (Applications, 8 units) as the first
   content build — pick by which is most ready. Run Phase 2 then Phase 3 for it,
   review, then proceed to the next block.
3. Confirmed blocks (Applications, Single-cell) before the `[?]` blocks
   (Bayesian, Penalized), so effort isn't spent on material that may move courses.

## Notes / risks

- **Single source of order:** `_quarto.yml` sidebar + `index.qmd`. Nothing else
  encodes sequence after Phase 0.
- **`[?]` blocks** (Bayesian, Penalized) may migrate to a later stats/ML course.
  They are independent folders, so removing them = deleting folders + sidebar
  entries. No cross-dependencies designed in.
- **`chemometrics-2`** is blocked on a subject-matter contributor.
- **SME review** required on all generated drafts before teaching.
- **Git:** nothing is committed automatically (standing preference — only `git add`
  on request).
- **Housekeeping:** done — `slides-image-audit.md` moved into `plan/`; the new
  blocks' figure audit is `plan/figure-audit-new-blocks.md`. `plan/` is excluded
  from the rendered site.
- **Write-collision guard:** a Draw worker once overwrote a `lec.qmd` with an SVG.
  Recovered from the authoring transcript. Future figure runs: instruct Draw
  workers to write ONLY to `*.svg` paths, and scan every `lec.qmd` for intact
  headings after the pass.

## Progress log

- 2026-07-17 — Linear-algebra block (10 decks, 133 slides): figure audit +
  79 SVGs added & QA'd. See `plan/slides-image-audit.md`.
- 2026-07-21 — This plan created; decisions locked (flat slugs, topic-based refs,
  all four remaining blocks).
- 2026-07-22 — **Deep per-figure QA (checklist-driven).** Built
  `plan/figure-qa-checklist.md` (headline rule: nothing overlaps text when space
  exists; plus axes, arrows-anchored-to-target, legend alignment, no internal
  dead-bands, proper tspan super/subscripts not ASCII). Piloted on `opls` (verified
  by hand), then ran one deep agent per figure across all 335 (240+85 in two waves
  around a usage-limit reset, +10 opls). Fixes: arrows/boxes/leaders rerouted off
  text, axis titles centred, captions pulled in / canvases shrunk, ASCII math →
  real super/subscripts. Gates: all well-formed XML, zero raw Unicode
  super/subscripts, svg/ref parity. Caveat: audited with cairosvg (≠ browser) since
  the sandbox browser can't reach these paths — glyph metrics need a final
  in-browser eyeball.
- 2026-07-22 — **SVG audit & tightening.** All 335 figures audited browser-accurately
  (cairosvg). Deterministic crop pass tightened 200 oversized canvases to their
  content bounding box (measured from rendered pixels + ~3% padding); backups in
  `scratchpad/svg-backup`. Per-deck visual audit fixed text placement and a
  systemic dropped-glyph issue (Unicode subscripts/superscripts/‖ → ASCII, so
  figures render identically in any font/browser); a focused re-audit widened the
  two boxes that clipped after the ASCII expansion. Gates: all well-formed XML,
  `orient="auto"`, zero risky glyphs, svg/ref parity, whole site renders clean.
- 2026-07-22 — **Plan executed.** Phase 0 rename (11 folders → slugs) + Phase 1
  (165 day/adjacency refs → topic-based). Phase 2: 24 new units authored
  (Applications 8, Bayesian 7, Penalized 5, Single-cell 4), wired into the sidebar.
  Phase 3: 256 figures added + browser-accurate QA. Whole site (34 decks, 335
  SVGs) renders clean. Everything is a **first draft pending SME review**; nothing
  committed to git.
