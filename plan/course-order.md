# Course order (agreed 2026-10-18)

Students move top to bottom through the sidebar. Five weeks; linear algebra
spans weeks 1–3 with applications mixed in. Anything that does not fit goes to
"Candidate material" at the end of the sidebar. Order lives in `_quarto.yml`;
folder names never change.

## Week 1 — Linear systems, vectors, transformations
1. solving-systems (+ warmups 01, 02, 05, 06, 08)
2. solving-systems-r (has the least-squares slide)
3. vectors-projection
4. matrix-transforms (+ warmups 03, 04, 07 bonus, 09)
5. matrix-images
6. compensation — Ax = b / the inverse on real data; unmixing = least squares.
   Stays after images: it uses "columns are where the axes land" and
   "one cell per column, like pixels".
7. polar — "not every coordinate change is a matrix"

## Week 2 — Bases, eigenvectors, PCA, Markov chains
1. eigen, eigen-r
2. markov, markov-r
3. pca, pca-r, pca-scree
4. fourier — another change of basis: fixed (Fourier) vs data-driven (PCA).
   Placed after PCA because the deck leans on PCA throughout.

## Week 3 — Linear models & differential expression
1. least-squares (NEW) — least squares as projection; how lm finds β
2. covariates
3. confounding
4. covariates-r — limma first (main path); DESeq2 reduced to a pointer to
   error models (week 4). Avoids the negative binomial in week 3.

## Week 4 — Penalized models & Bayesian statistics (overview, tight)
1. penalized-intro (follows from week 3's p > n slide)
2. ridge-lasso-enet
3. crossval
4. bayes-intro
5. bayes-fitting (brms)
6. error-models (Poisson, NB; where DESeq2's model comes in)
7. hierarchical
8. penalty-bayes-link (ties both halves together)
If it must shrink further: crossval or hierarchical next.

## Week 5 — Nonlinear models & latent spaces
1. nonlinear (NEW) — linear-in-β vs truly nonlinear; one nls fit
   (dose–response); a neural net = matrix × vector + nonlinearity, stacked
2. scrna-intro — the application dataset
3. scrna-umap — framed as "Nonlinear embeddings: kNN graphs & UMAP"
4. vae
5. scrna-annotation (marker DE recaps week 3)

## Candidate material
scrna-log (moved out of week 3 on 2026-10-30: pseudolog and size factors in
this depth are not needed; scrna-intro covers normalize + log1p briefly),
rstan-intro, bayes-case, penalized-case, scrna-cellcycle, kernels, ctmc, hmm,
hmm-r, opls, chemometrics-1, chemometrics-2, multiome.

## Housekeeping done with the reorder
- Remove the "Provisional block" callouts (bayes-fitting, hierarchical); the
  bayes-fitting one also had exam wording.
- Fix "next/previous unit" pointers and recaps that assumed the old order.
