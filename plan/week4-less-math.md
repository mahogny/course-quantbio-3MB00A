# Week 4: less maths, more demos (started 2026-10-30)

Goal: students are not strong at maths; week 4 teaches concepts. Differentiation is
never required. Matrix inverses, eigenvalues, rank, argmin/norm notation, pdf/pmf
formulas, integrals and derivations leave the main path. Mathier items may stay,
marked (optional), in one shared style:

    ::: {.callout-note collapse="true" title="Optional: the maths"}

Concepts are carried by interactive demos instead.

## Demos

| demo | status | used in |
|---|---|---|
| `biasvar` (new) | bias–variance, λ dial, train vs test error | penalized-intro, ridge-lasso-enet, crossval |
| `cvfolds` (new) | k-fold CV, lambda.min / lambda.1se, grouped CV | crossval, ridge-lasso-enet |
| `penaltygeom` mode `resample` (new) | correlated genes: OLS cloud vs ridge cloud | penalized-intro, ridge-lasso-enet |
| `penaltygeom` mode `prior1d` (new) | penalty = prior; Laplace gives exact 0 | penalty-bayes-link, ridge-lasso-enet |
| `bayesgrid` (new) | prior × likelihood → posterior on a few hypotheses | bayes-intro, bayes-fitting, error-models |
| `bayesline` (new) | posterior regression lines, prior strength, bands | bayes-fitting (penalty-bayes-link) |
| `poissonprocess` (new) | events, counts vs gaps, mean = variance | error-models |
| `pseudorep` (new) | pseudoreplication, ICC, false positives | hierarchical |
| `betabinom` threshold + repeat-CI (extension) | tail area as a picture; CI coverage | bayes-intro, bayes-fitting |
| reuse: `mcmc`, `countratio`, `leakage`, `shrinkage`, `nbdisp` | | bayes-fitting, error-models, crossval, hierarchical |

## Units

Per-unit item lists are in the two survey reports (session 2026-10-30); the unit
agents re-derive them from the files. Also: penalty-bayes-link has no quiz and is
not in `_quarto.yml`; bayes-fitting has no quiz. Bonus quiz week 4 Q3–Q5 touch
these units (Q4 needs the Poisson pmf: give likelihood values or `dpois`).

## Follow-ups (collected from unit agents)

- DONE: hierarchical fig06 (precision-weight balance) and fig08 (two-level model) still show subscripted formulas (μ̂_i = w_i·ȳ_i…, y_ij = μ + b_i + ε_ij); relabel to match the new unsubscripted wording.
- DONE: bayes-fitting: illustrative brms table and fig13/fig14 (slope 0.018 per year, P = 0.98) differ from the bayesline/mcmc demo numbers (0.30 per 10 years, 96%); biology slide says ~15 donors, demos use 12.
- Bonus quiz Q4 now gives the dpois values (done 2026-10-30). yaml reinstalled; check.R passes for all 25 questions.
