# Time plan by day — 3MB00A

Course runs **2026-11-02 (Mon) → 2026-12-21 (Mon)**.

## Study days available

Counting weekdays only (Mon–Fri), excluding weekends and Swedish public holidays
("röda dagar"):

- **Calendar span:** 50 days
- **Weekend days:** 14
- **Swedish red days on weekdays in this window:** 0
- **→ Study days: 36**

### On the red days

No Swedish public holiday falls on a weekday within the course window:

- **Alla helgons dag** (All Saints' Day) is Saturday **2026-10-31** — a weekend, and
  before the course starts.
- **Lucia** (Dec 13) is *not* a public holiday, and in 2026 it falls on a Sunday anyway.
- **Christmas** red days (Julafton/Juldagen/Annandag jul, Dec 24–26) all fall *after*
  the course ends on Dec 21.

So the only non-study days in the span are the 14 weekend days.

## Workload

ECTS measures *total* student workload (lectures, exercises, reading, self-study),
not contact hours. The EU/Bologna standard is **1 ECTS ≈ 25–30 h**; the Swedish
norm is **1 ECTS ≈ 26.7 h** (60 ECTS = 40 weeks ≈ 1600 h, i.e. 1.5 ECTS = 1 week of
full-time study).

For **7.5 ECTS**:

| Basis | Total hours |
|------|------------:|
| 25 h/ECTS | ~188 h |
| **26.7 h/ECTS (Swedish norm)** | **~200 h** |
| 30 h/ECTS | ~225 h |

So the course is **≈ 200 h ≈ 5 weeks of full-time study**.

**Delivery:** no scheduled lectures or labs. Each study day has one short
**pre-recorded video (~30 min)**; students then work **at their own pace**. Of the
36 days, ~34 carry a recording (≈ 17 h of video total); the remaining ~183 h is
self-paced exercises, reading, and practice — roughly **5 h of self-study per
recording day**.

> **Note on pace:** the 36 weekdays are *calendar* study days at roughly **70 % of
> a 40 h week** (~200 h ÷ 36 ≈ 5–6 h/day). Because the work is self-paced, the
> day-by-day calendar below is a **recording-release and suggested-pacing**
> schedule, not fixed attendance — students may run ahead or catch up.

## Day-by-day calendar (recording-release / suggested pacing)

**Delivery model:** there are no scheduled lectures or lab sessions. Each study day
has one short **pre-recorded video (~30 min)**; students then work **at their own
pace** on the matching exercises. The dates below are therefore a *recording-release
and suggested-pacing* schedule, not fixed attendance days — a student can run ahead
or catch up. Worked R walkthroughs are delivered **as recordings** (marked
"R walkthrough"), not as in-person labs.

Topics are distributed by difficulty (see
[contentplan.md → Difficulty & day allocation](contentplan.md)): the hardest,
most foundational blocks (linear algebra, Bayesian) get the most recordings, and
each new method is followed by a recorded R walkthrough plus self-paced practice.

| Day | ISO week | Weekday | Date | Block | Recording topic (~30 min) + self-paced work |
|----:|:--------:|:-------:|------|-------|---------------------------------------------|
| 1 | 45 | Mon | 2026-11-02 | Linear algebra | Course intro; solving linear equation systems (by hand, small cases) |
| 2 | 45 | Tue | 2026-11-03 | Linear algebra | Linear systems in R (`solve`); solution spaces — unique / none / infinitely many |
| 3 | 45 | Wed | 2026-11-04 | Linear algebra | Geometric interpretation: vectors, dot product, projection |
| 4 | 45 | Thu | 2026-11-05 | Linear algebra | Matrices as transformations — R walkthrough |
| 5 | 45 | Fri | 2026-11-06 | Linear algebra | Eigenvalues & eigenvectors — concept |
| 6 | 46 | Mon | 2026-11-09 | Linear algebra | Eigenvalues in R (`eigen`) — R walkthrough |
| 7 | 46 | Tue | 2026-11-10 | Linear algebra | Intro to Markov chains: discrete time, transition matrices, formulating chains |
| 8 | 46 | Wed | 2026-11-11 | Linear algebra | Solving Markov-chain equations in R; stationary distribution — R walkthrough |
| 9 | 46 | Thu | 2026-11-12 | Linear algebra | Intro to Hidden Markov Models — concept |
| 10 | 46 | Fri | 2026-11-13 | Linear algebra | Fitting HMMs in R; application to genome data — R walkthrough |
| 11 | 47 | Mon | 2026-11-16 | Applications | PCA — computing it (link to eigen-decomposition of the covariance matrix) |
| 12 | 47 | Tue | 2026-11-17 | Applications | PCA — scree-plot analysis; data reduction |
| 13 | 47 | Wed | 2026-11-18 | Applications | PCA in R — R walkthrough; pitfalls; quick look at ICA as "beyond PCA" |
| 14 | 47 | Thu | 2026-11-19 | Applications | The OPLS model |
| 15 | 47 | Fri | 2026-11-20 | Applications | Multiome data integration (RNA-seq counts vs. proteomics); interpretation |
| 16 | 48 | Mon | 2026-11-23 | Applications | Chemometrics #1 |
| 17 | 48 | Tue | 2026-11-24 | Applications | Chemometrics #2  **[? needs topic expert]** |
| 18 | 48 | Wed | 2026-11-25 | Applications | "Cute intro" to the Fourier transform for image analysis (lighter day) |
| 19 | 48 | Thu | 2026-11-26 | Bayesian | Intro to Bayesian statistics; Bayesian vs. frequentist; R-STAN setup |
| 20 | 48 | Fri | 2026-11-27 | Bayesian | Fitting equations in R-STAN — R walkthrough |
| 21 | 49 | Mon | 2026-11-30 | Bayesian | Error models: the exponential and Poisson distributions |
| 22 | 49 | Tue | 2026-12-01 | Bayesian | Fitting count models in R-STAN — R walkthrough |
| 23 | 49 | Wed | 2026-12-02 | Bayesian | Handling common covariates: age, sex, BMI, treatments |
| 24 | 49 | Thu | 2026-12-03 | Bayesian | Hierarchical models: biological vs. technical replicates |
| 25 | 49 | Fri | 2026-12-04 | Bayesian | Hierarchical model — R walkthrough / consolidation |
| 26 | 50 | Mon | 2026-12-07 | Penalized models | L1, L2, elastic net |
| 27 | 50 | Tue | 2026-12-08 | Penalized models | Similarity to certain Bayesian models |
| 28 | 50 | Wed | 2026-12-09 | Penalized models | `glmnet` case analysis — R walkthrough |
| 29 | 50 | Thu | 2026-12-10 | Penalized models | Pitfalls: identifiability etc. |
| 30 | 50 | Fri | 2026-12-11 | Penalized models | Cross-validation |
| 31 | 51 | Mon | 2026-12-14 | Single-cell | Intro to the topic; basic preprocessing of data |
| 32 | 51 | Tue | 2026-12-15 | Single-cell | UMAPs and clustering |
| 33 | 51 | Wed | 2026-12-16 | Single-cell | Interpretation; annotation of cell types |
| 34 | 51 | Thu | 2026-12-17 | Single-cell | Cell-cycle analysis; connection to PCA |
| 35 | 51 | Fri | 2026-12-18 | Revision | No new recording — self-paced revision / exam prep |
| 36 | 52 | Mon | 2026-12-21 | Exam | **Written exam** (individual, on campus) — *confirm date* |
