# Code correctness audit checklist

Scope: every source document with an executable code fence (367 chunks when inventoried on 2026-09-13), plus the build and site configuration files listed below. Generated `docs/` output and binary/vector figures are excluded; they are audited by rendering the source.

Audit completed on 2026-09-13. All items below were reviewed at least once; files with findings were corrected and re-reviewed.

Mark an item complete only after a reviewer has checked every executable chunk for syntax, dependencies, data-shape assumptions, numerical correctness, and consistency with its surrounding teaching material. Record fixes in the Git history.

## Executable teaching documents

- [x] `bayes-case/exercise.qmd`
- [x] `bayes-case/lec.qmd`
- [x] `bayes-fitting/exercise.qmd`
- [x] `bayes-fitting/lec.qmd`
- [x] `bayes-intro/exercise.qmd`
- [x] `bayes-intro/lec.qmd`
- [x] `chemometrics-1/exercise.qmd`
- [x] `chemometrics-1/lec.qmd`
- [x] `chemometrics-2/exercise.qmd`
- [x] `chemometrics-2/lec.qmd`
- [x] `covariates/exercise.qmd`
- [ ] `ctmc/exercise.qmd` — added 2026-10-16; needs audit (R chunks run with `Rscript --vanilla`; outputs pasted into the solutions)
- [ ] `ctmc/lec.qmd` — added 2026-10-16; needs audit
- [ ] `ctmc/quiz.qmd` — added 2026-10-16; needs audit
- [ ] `ctmc/make-ctmc-figs.R` — added 2026-10-16; needs audit
- [ ] `vae/exercise.qmd` — added 2026-10-16; needs audit (R chunks run with `Rscript --vanilla`; outputs pasted into the solutions; Explore solutions quote numbers from the trained demo models)
- [ ] `vae/lec.qmd` — added 2026-10-16; needs audit
- [ ] `vae/quiz.qmd` — added 2026-10-16; needs audit
- [ ] `vae/make-vae-figs.R` — added 2026-10-16; needs audit
- [ ] `kernels/exercise.qmd` — added 2026-10-16; needs audit (R chunks run with `Rscript --vanilla`; outputs pasted into the solutions; Explore solutions quote numbers read from the demo)
- [ ] `kernels/lec.qmd` — added 2026-10-16; needs audit
- [ ] `kernels/quiz.qmd` — added 2026-10-16; needs audit
- [ ] `kernels/make-kernel-figs.R` — added 2026-10-16; needs audit (reads `demos/src/fourier2d/cell256.png`; needs the `png` package)
- [x] `covariates/lec.qmd`
- [x] `crossval/exercise.qmd`
- [x] `crossval/lec.qmd`
- [x] `eigen-r/exercise.qmd`
- [x] `eigen-r/lec.qmd`
- [ ] `eigen/exercise.qmd` — reworked 2026-10-15 (det-free eigenvalue path, det moved to bonus); chunks re-run with `Rscript --vanilla`, needs re-audit
- [x] `error-models/exercise.qmd`
- [x] `error-models/lec.qmd`
- [x] `fourier/exercise.qmd`
- [x] `fourier/lec.qmd`
- [x] `hierarchical/exercise.qmd`
- [x] `hierarchical/lec.qmd`
- [x] `hmm-r/exercise.qmd`
- [x] `hmm-r/lec.qmd`
- [x] `hmm/exercise.qmd`
- [x] `index.qmd`
- [x] `intro/install.qmd`
- [x] `markov-r/exercise.qmd`
- [x] `markov-r/lec.qmd`
- [x] `markov/exercise.qmd`
- [ ] `matrix-images/exercise.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `matrix-images/lec.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `matrix-images/make-image-figs.R` — figure script added 2026-10-14, needs audit
- [ ] `polar/exercise.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `polar/lec.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `polar/make-polar-figs.R` — figure script added 2026-10-14, needs audit
- [ ] `compensation/exercise.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `compensation/lec.qmd` — new unit 2026-10-14; chunks smoke-tested with `Rscript --vanilla`, needs audit
- [ ] `compensation/make-comp-figs.R` — figure script added 2026-10-14, needs audit
- [ ] `fourier/make-fourier-figs.R` — figure script added 2026-10-14, needs audit
- [ ] `matrix-transforms/exercise.qmd` — by-hand B7 (rotate then flip) added 2026-10-14, needs re-audit
- [ ] `matrix-transforms/lec.qmd` — bonus determinant slide (new `det()` chunk) added 2026-10-14, needs re-audit
- [x] `multiome/exercise.qmd`
- [x] `multiome/lec.qmd`
- [x] `opls/exercise.qmd`
- [x] `opls/lec.qmd`
- [x] `pca-r/exercise.qmd`
- [x] `pca-r/lec.qmd`
- [x] `pca-scree/exercise.qmd`
- [x] `pca-scree/lec.qmd`
- [x] `pca/exercise.qmd`
- [x] `pca/lec.qmd`
- [x] `penalized-case/exercise.qmd`
- [x] `penalized-case/lec.qmd`
- [ ] `penalized-intro/exercise.qmd` — 2026-10-15: `det(XtX)` line removed from the near-singular chunk (det now bonus); needs re-audit
- [x] `penalized-intro/lec.qmd`
- [x] `penalty-bayes-link/exercise.qmd`
- [x] `penalty-bayes-link/lec.qmd`
- [x] `ridge-lasso-enet/exercise.qmd`
- [x] `ridge-lasso-enet/lec.qmd`
- [x] `rstan-intro/exercise.qmd`
- [x] `rstan-intro/lec.qmd`
- [x] `scrna-annotation/exercise.qmd`
- [x] `scrna-annotation/lec.qmd`
- [x] `scrna-cellcycle/exercise.qmd`
- [x] `scrna-cellcycle/lec.qmd`
- [x] `scrna-intro/exercise.qmd`
- [x] `scrna-intro/lec.qmd`
- [ ] `scrna-log/exercise.qmd` — added 2026-10-15; needs audit
- [ ] `scrna-log/lec.qmd` — added 2026-10-15; needs audit
- [ ] `scrna-log/make-log-figs.R` — added 2026-10-15; needs audit
- [x] `scrna-umap/exercise.qmd`
- [x] `scrna-umap/lec.qmd`
- [ ] `solving-systems-r/exercise.qmd` — 2026-10-15: rank replaces det as the singularity check (det now bonus); needs re-audit
- [ ] `solving-systems-r/lec.qmd` — 2026-10-15: rank replaces det as the singularity check (det now bonus); needs re-audit
- [ ] `solving-systems/exercise.qmd` — inverse via [A | I] added 2026-10-15, needs re-audit
- [ ] `solving-systems/lec.qmd` — inverse via [A | I] added 2026-10-15, needs re-audit
- [ ] `solving-systems/quiz.qmd` — 2026-10-15: Q12 added (2×2 inverse by row-reducing [A | I]); needs re-audit
- [x] `vectors-projection/exercise.qmd`
- [x] `vectors-projection/lec.qmd`
- [x] `warmups/01-matrix-anatomy-and-arithmetic.qmd`
- [x] `warmups/02-matrix-vector-product.qmd`
- [x] `warmups/03-matrix-matrix-product.qmd`
- [x] `warmups/04-transpose-and-special.qmd`
- [x] `warmups/05-solving-2x2.qmd`
- [x] `warmups/06-solving-3x3.qmd`
- [x] `warmups/07-determinants.qmd`
- [ ] `warmups/08-inverse-2x2.qmd` — rewritten 2026-10-15 (inverse via [A | I] row reduction; det formula now bonus); R chunk re-run, needs re-audit
- [ ] `warmups/09-mixed-drills.qmd` — 2026-10-15: inverses via [A | I] row reduction, drill 9 via parallel columns (det bonus); needs re-audit

## Build and presentation code

- [ ] `Makefile` — `figs` target added 2026-10-14; `demos`/`typecheck` targets added 2026-10-16; needs re-audit
- [ ] `_quarto.yml` — 2026-10-16: demos/dist resources, "Interactive demo" sidebar entries; needs re-audit
- [ ] `styles.css` — 2026-10-16: orange colour for demo sidebar links; needs re-audit
- [x] `theme.scss`

## Interactive demos (TypeScript, added 2026-10-16)

Each demo was checked by its author (node tests of the maths, scripted clicks in headless Chrome, slide screenshots), but none has been independently reviewed. Real mouse/touch dragging is untested for all of them. The demos are embedded in a "Try it" slide and/or an "Explore" section of the exercise page; those .qmd sections also need review.

- [ ] `demos/build.sh`, `demos/tsconfig.json`, `demos/demo.css`, `demos/src/lib/ui.ts`
- [ ] `demos/src/matrix2x2/` — matrix-transforms, matrix-images, eigen
- [ ] `demos/src/dotproduct/` — vectors-projection
- [ ] `demos/src/twolines/` — solving-systems, solving-systems-r (added 2026-10-16; needs audit; classification by one elimination step R2 − m·R1 in `math.ts`, tolerance 1e-9 relative; drag snapping in `shiftTo`/`turnTo`)
- [ ] `demos/src/compensation/` — compensation
- [ ] `demos/src/markov/` — markov, markov-r (self-loop animation added 2026-10-16)
- [ ] `demos/src/pca2d/` — pca, pca-scree
- [ ] `demos/src/fourier2d/` — fourier
- [ ] `demos/src/polar/` — polar
- [ ] `demos/src/betabinom/` — bayes-intro
- [ ] `demos/src/mcmc/` — rstan-intro
- [ ] `demos/src/nbdisp/` — error-models, bayes-case
- [ ] `demos/src/shrinkage/` — hierarchical, bayes-case
- [ ] `demos/src/leakage/` — crossval
- [ ] `demos/src/penaltygeom/` — ridge-lasso-enet, penalty-bayes-link, penalized-case
- [ ] `demos/src/pseudocount/` — scrna-log
- [ ] `demos/src/ctmcwalkers/` — ctmc (added 2026-10-16; needs audit; imports `stationary` from `demos/src/markov/chain.ts`)
- [ ] `demos/src/umaplive/` — scrna-umap (added 2026-10-16; needs audit; simplified UMAP in `umap.ts`: exact kNN, rho/sigma search, fuzzy union, a/b fit, SGD with negative sampling, power-iteration spectral init)
- [ ] `demos/src/vaegen/` — vae (added 2026-10-16; needs audit). Two tabs with fixed weights: a count VAE (`data.ts` simulated cells, `vae.ts` forward pass, `weights.ts` generated by `train.ts`, a plain-TS trainer with hand-written backprop + Adam and an NB likelihood, run via esbuild + node) and an MNIST VAE (`digits.ts`, int8 weights in `mnist_weights.ts` generated by `train_mnist.py` with torch; MNIST itself is not in the repo). Imports `rnb`/`lgamma` from `demos/src/nbdisp/stats.ts`.
- [ ] `demos/src/leiden/` — scrna-umap (added 2026-10-16; needs audit; Leiden and Louvain with modularity + resolution in `leiden.ts`: queue-based local move, refinement, aggregation on the refined partition, passes until stable; imports the data, kNN/fuzzy graph and UMAP layout from `demos/src/umaplive/`, which is unchanged)
- [ ] `demos/src/hmmcpg/` — hmm (added 2026-10-16; needs audit; 2-state H/L HMM over A/C/G/T in `hmm.ts`: simulation from fixed uniforms, scaled forward–backward posterior and log-likelihood, log-space Viterbi; checked against brute force over all 2^n paths for n ≤ 10)
- [ ] `demos/src/kernel3x3/` — kernels (added 2026-10-16; needs audit; 3 × 3 filtering without kernel flip in `conv.ts` (replicate/zero borders, repeat, display mapping); Node-tested: identity, constant images, Sobel sign on a step, shift direction, by-hand examples; imports `cell256.png` from `demos/src/fourier2d/`, which is unchanged)
