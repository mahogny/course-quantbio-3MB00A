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
- [x] `scrna-umap/exercise.qmd`
- [x] `scrna-umap/lec.qmd`
- [x] `solving-systems-r/exercise.qmd`
- [x] `solving-systems-r/lec.qmd`
- [ ] `solving-systems/exercise.qmd` — inverse via [A | I] added 2026-10-15, needs re-audit
- [ ] `solving-systems/lec.qmd` — inverse via [A | I] added 2026-10-15, needs re-audit
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
- [x] `warmups/09-mixed-drills.qmd`

## Build and presentation code

- [ ] `Makefile` — `figs` target added 2026-10-14, needs re-audit
- [x] `_quarto.yml`
- [x] `styles.css`
- [x] `theme.scss`
