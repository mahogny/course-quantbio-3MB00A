# Bulk RNA-seq day with DESeq2 (end of week 3) — plan

Status: draft for discussion, 2026-10-30.

## Place in the course

Week 3 becomes: least-squares → covariates → confounding → covariates-r (limma)
→ **bulk-rnaseq** (new). Folder name suggestion: `bulk-rnaseq` (concepts) and,
if the deck grows, `bulk-rnaseq-r` (the DESeq2 walk-through), keeping each deck
small.

Everything about design matrices is already in place (covariates, confounding,
covariates-r). The day adds only three ideas, all on raw counts:

1. RNA-seq is counting molecules.
2. Size factors: what fraction of the RNA comes from each gene.
3. Ratios of small counts are noisy. This is the motivation for a count model
   (named and built in week 4) and for shrinkage (penalization, week 4).

No Poisson or negative binomial by name in the main line; at most one sentence
"week 4 gives this noise a name".

## Story, slide by slide (~10–12 slides)

### 1. RNA-seq is counting
- A biology picture: cells → RNA → fragments → reads → "gene G got 512 reads".
- The sampling picture: the library is a bag of RNA fragments; sequencing draws
  N of them at random. Gene G makes up a fraction p of the bag, so it gets about
  N · p reads.
- Consequence: a count says nothing on its own. 512 reads out of 10 M is not
  512 out of 40 M. What we want per gene is **p**, the share of the RNA.
- Contrast with limma's input in covariates-r: there we started from log2
  values; here we start one step earlier, from the counts table
  (genes × samples).

### 2. Size factors = "how much did we sequence this sample"
- Naive: p ≈ count / total reads (counts per million is the same with ×10⁶).
  Total reads per sample = the first size factor.
- By hand: a 4-gene × 2-sample table where sample 2 was simply sequenced twice
  as deep; dividing by the totals makes them equal.
- The catch (one slide): composition. If one very abundant gene goes up a lot
  in sample 2, all other genes' shares go down although nothing happened to
  them. "% of RNA" is a zero-sum game.
- DESeq2's fix, kept to its idea: compare each gene to its typical value
  across samples (a ratio), and take the **median** ratio over genes as the
  sample's size factor. The median ignores the few genes that really changed.
  By hand on a 5-gene × 3-sample table. Mention that genes with a zero are left
  out (ratios with 0 are useless — a natural lead into slide 3).
- In R: `estimateSizeFactors(dds)`; `sizeFactors(dds)`;
  `counts(dds, normalized = TRUE)`.

### 3. Why x / y is noisy for small x and y (the core new idea)
- Set-up: two samples, **same** true share for every gene, same depth. Any
  difference is pure counting noise.
- Big gene (expected 1000 reads): counts like 1012 and 987, ratio 1.03.
  Small gene (expected 2): counts like 0 and 3, 1 and 4, 3 and 0 → ratios 0,
  ∞, 4, 0.25. Same truth, wildly different fold changes.
- Rule of thumb, stated empirically from a simulation (no distribution named):
  if you expect about n molecules, you get n ± √n. Relative noise ≈ 1/√n:
  10% at 100 reads, 3% at 1000, 70% at 2.
- The picture that sticks: the **MA plot fan** (log fold change vs mean count)
  for two replicate samples with no true change. Wide at low counts, narrow at
  high counts.
- Consequence 1: ranking genes by fold change picks the low-count genes. "The
  top-10 fold changes are all noise."
- Consequence 2: a test must know that 3 vs 0 carries less information than
  3000 vs 1000. The noise depends on the mean count: a plain least-squares fit
  with one σ for everything does not know this. This is what a count model
  (week 4) provides. (voom's weights in covariates-r were a patch for the same
  problem: link back.)
- Replicates vary more than counting alone (biological variation); one line,
  "week 4 adds this extra spread".
- Interactive demo (reuse the demo framework): slider for the expected count;
  shows simulated pairs and the spread of log2(x / y), plus the fan.

### 4. The DESeq2 workflow
- `DESeqDataSetFromMatrix(counts, colData, design = ~ batch + treatment)`:
  the design formula from covariates, unchanged.
- `DESeq(dds)` does: size factors (slide 2) → per-gene count model with
  mean-dependent noise (slide 3; named in week 4) → a test per coefficient.
- `results(dds, name = "treatment_treat_vs_ctrl")`: baseMean, log2FoldChange,
  lfcSE, padj. Point at lfcSE: large exactly for small baseMean.
- MA plot of the real result: the fan again.

### 5. Segue to penalization: shrink the noisy fold changes
- `lfcShrink(dds, coef = ..., type = "apeglm")`: low-count fold changes are
  pulled towards 0, high-count ones barely move. Before/after MA plot.
- The idea in one sentence: "when the data are weak, believe less extreme
  values". This is exactly penalization (week 4: ridge) and a prior (week 4:
  Bayes). Do not explain how; promise it.
- Practical rule: rank by shrunken LFC; test with padj.

### 6. Summary + where this leads
- counts → share of RNA (size factors) → noisy ratios at low counts → count
  model (week 4: error models) + shrinkage (week 4: penalized, Bayes,
  hierarchical).

## Exercise (by hand + R)

By hand:
- B1 counts to shares; same library twice as deep.
- B2 composition trap: one huge gene goes up; compute shares; spot the fake
  "down" genes.
- B3 median-of-ratios size factors on a 5 × 3 table (whole numbers chosen so
  ratios are nice).
- B4 fold changes of small vs large counts from a given table of replicate
  pairs; which top-ranked genes would you trust?

R:
- R1 simulate sequencing as drawing from a bag:
  `table(sample(genes, N, replace = TRUE, prob = p))` for two replicates;
  plot log2 ratio vs mean (the fan). No distribution named.
- R2 the n ± √n rule from the simulation.
- R3 DESeq2 on the simulated dataset used in covariates-r (same design,
  compare with limma's calls), then on `airway` (already used in the optional
  part of the covariates-r exercise; becomes the main path here).
- R4 `lfcShrink` and the before/after MA plot.

## Changes elsewhere

- **covariates-r**: the "Extra material: raw counts with DESeq2" slide and the
  optional D-part of its exercise move into the new unit; covariates-r points
  forward instead. Its voom notes ("low counts are noisier on the log scale")
  get a forward link.
- **error-models (week 4)**: open with the fan from the bulk day: "this is
  the noise; now we name it" (Poisson = counting noise, NB = plus biological
  spread). Drop or shorten material that re-motivates count noise.
- **penalized-intro / hierarchical / penalty-bayes-link**: one recall each of
  `lfcShrink` as the running example of shrinkage.
- **Bonus quiz week 3**: five units again, so Q1 moves back from the second
  covariates question to bulk-rnaseq (e.g. a median-of-ratios size factor,
  numeric). Update plan/canvas-quizzes.md.
- **plan/course-order.md, _quarto.yml, index.qmd** week 3 line.
- **scrna-log** (candidate): its pseudocount/fold-change table is the same
  phenomenon seen through a log; link it as optional further reading.

## Decisions (2026-10-30)

1. One deck, R calls inline; the exercise carries the R work.
2. DESeq2 only here. covariates-r keeps limma as its path; its DESeq2 extra
   material moves here.
3. Poisson / negative binomial may be named, with the maths forward-referenced
   to Error models (week 4).
4. Simulated data for the concepts, `airway` for the real run.
