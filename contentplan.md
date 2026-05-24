# Content plan — 3MB00A

A working week-by-week draft of the course content. This is a planning document,
not a contract: weeks will shift, merge, and split as the
[method ↔ biology pairings](designprinciples.md) become clearer. See
[elo.md](elo.md) for the learning outcomes and [courseplan.md](courseplan.md) for
the official syllabus.

Open questions are marked **[?]**.

## Difficulty & day allocation

There are **36 study days** in the course window (see
[timeplan_by_day.md](timeplan_by_day.md)). Days are allocated **by difficulty for
this audience** (biologists with no prior linear algebra and no ML/PCA background —
see [audience.md](audience.md)), so the hardest, most foundational material gets the
most time.

| Block | Topic | Difficulty | Teaching days | Calendar |
|------:|-------|------------|:-------------:|----------|
| 1 | Linear algebra | **Hard** — foundational, biggest hurdle | 10 | weeks 45–46 |
| 2 | Applications (PCA, OPLS, chemometrics, Fourier) | Hard / broad | 8 | weeks 47–48 |
| 3 | Bayesian statistics **[?]** | **Hard** — new mode of thinking | 7 | weeks 48–49 |
| 4 | Penalized linear models **[?]** | Moderate | 5 | week 50 |
| 5 | Single-cell analysis | Moderate (applied) | 4 | week 51 |
| — | Revision + written exam | — | 2 | Dec 18 + Dec 21 |

> **Delivery & assumptions** (adjust freely): no scheduled lectures or labs —
> each day has one short **pre-recorded video (~30 min)**, released Mon–Fri across
> calendar weeks 45–51, and students work **at their own pace**. Worked R examples
> are themselves recordings, not in-person labs. The dates are a recording-release /
> suggested-pacing schedule, not fixed attendance. The **written exam** is placed
> on the final day, **Mon 2026-12-21** (confirm against the official exam schedule).
> If the **[?]** blocks (Bayesian, penalized models) move to the later
> statistics/ML course, redistribute the freed ~12 days into deeper linear-algebra
> and PCA practice plus a larger buffer.

## Week 1 — Linear algebra (math focus) · *Hard, foundational · ~10 days*

- Solving equation systems
- Geometric interpretation
- Eigenvalues
- Intro to Markov chains
  - Discrete time; no derivations
  - Formulating chains
  - Solving the equations in R
- Intro to Hidden Markov models
  - Fitting models using R
  - Application to genome data

## Week 2 — Applications · *Hard / broad · ~8 days*

- PCA
  - Computing it
  - Scree-plot analysis
  - Applications to data reduction
  - Pitfalls; could also quickly show ICA as an example of "beyond PCA"
- The OPLS model
- Multiome data integration
  - E.g. RNA-seq counts vs. proteomics
  - Interpretation
- Chemometrics #1
- Chemometrics #2
  - **[?]** Need someone who knows this topic and can help out
- "Cute intro" to Fourier transform for image analysis
  - Mainly to show that the topic exists, and that other types of basis functions
    can be useful

## Week 3 — Bayesian statistics · *Hard · ~7 days*

> **[?]** Should this rather go in the statistics / ML course later?

- Introduction to R-STAN
- Fitting of equations
- Error models: the exponential and Poisson distributions
- Handling common covariates: age, sex, BMI, treatments
- Hierarchical models: what are biological and technical replicates?

## Week 4 — Penalized linear models · *Moderate · ~5 days*

> **[?]** Should this rather go in the statistics / ML course later?

- L1, L2, elastic net
- Explore similarity to certain Bayesian models
- Further case analysis
- Pitfalls: identifiability etc.
- Cross-validation

## Week 5 — Single-cell analysis · *Moderate, applied · ~4 days + buffer*

- Introduction to the topic. Basic preprocessing of data
- UMAPs and clustering
- Interpretation of data; annotation of cell types
- Cell-cycle analysis, and connection to PCA

--buffer--
