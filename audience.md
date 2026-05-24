# Audience

This course (**3MB00A**) sits in the middle of year 1 of the
[Master's Programme in Bioinformatics](mscprogram.md). Two audiences reach it, and
the material must serve both:

1. **Programme students (the majority).** They arrive having already completed,
   in this order, three directly relevant courses:
   *Computing for data driven biology* → *Statistics and data science for
   biologists* → *Programming in Python for bioinformatics*. They are **not**
   novices in programming or statistics. Note: *Statistics and machine learning in
   bioinformatics* is **not** a prerequisite (it runs concurrently or after), so we
   do **not** assume any machine-learning or PCA background from it.
2. **Stand-alone / entry-level students.** The formal
   [entry requirement](courseplan.md) is only 90 ECTS in biology (or a related
   field) plus 5 ECTS of programming in R or Python. The course must therefore not
   *hard-depend* on those three courses, even though most students will have taken
   them.

The practical consequence: **pitch the teaching to the programme student, but make
every hard dependency on prior courses explicit and recoverable**, so a capable
entry-level student can catch up from a linked refresher rather than being lost.

## What we can expect them to know

### Biology / domain
- Solid molecular biology, genetics, and cell biology.
- Familiarity with omics data: gene-expression tables, sequencing **count** data,
  sample × feature matrices, phenotype/metadata tables.
- Have seen real high-throughput data and read methods sections of papers.

### Programming
- **Can program.** Comfortable in Python; at least functional in R (vectors,
  data frames, indexing, functions, loops, reading CSV/TSV, plotting).
- Run scripts/notebooks; install packages (`install.packages`, `BiocManager`, `pip`).
- *Entry-level caveat:* a stand-alone student may know only one of R/Python and
  may be shaky in R specifically — keep R idioms lightly explained the first time.

### Statistics (from prior courses)
- Descriptive statistics, common distributions by name, sampling, estimation.
- Hypothesis testing, p-values, confidence intervals.
- Linear regression / linear models as a fitted tool (`lm`).
- Data wrangling and plotting on real datasets (from the *Statistics and data
  science for biologists* course).
- *Entry-level caveat:* a stand-alone student has only "basic statistics," so
  treat anything past descriptive stats + a t-test as "recap, don't assume."
- **Not assumed:** machine learning, train/test workflows, or PCA — the ML course
  is not a prerequisite. PCA / dimensional reduction is introduced *here*.

## What we should NOT assume they know

This is the gap the course is built to close — the **mathematical machinery
underneath** the tools they have already used.

### Linear algebra (the central gap)
- Matrix multiplication, transpose, identity, **inverse**, rank.
- The **solution space** of a linear system `Ax = b` — unique / none / infinitely many.
- Vector geometry: dot product, norm, projection, orthogonality, basis, subspace.
- **Eigenvalues and eigenvectors**, and why they matter.
- What PCA / SVD are — and what they *do*. Most will not have met them at all
  (the ML course is not a prerequisite); treat PCA as new, building it from the
  eigen-decomposition of a covariance matrix.
- What a **latent space** is, formally.

### Probability & distributions (beyond applied use)
- PMFs/PDFs, expectation, variance from first principles.
- The **Poisson** and **negative binomial** distributions, and **overdispersion** —
  *why* count data needs them rather than a Gaussian.
- **Bayesian** reasoning: Bayes' theorem, prior / likelihood / posterior, and the
  **Bayesian vs. frequentist** distinction (their prior stats was likely frequentist).

### Other
- **Markov chains** — transition matrices, state evolution, stationary distributions.
- **Chemometrics** as a field and its methods.
- Matrix/linear-algebra fluency in R beyond surface use (`%*%`, `solve`, `eigen`, `prcomp`, `svd`).

## Pedagogical implications
- Lead every mathematical concept with a concrete biological example (count
  matrices, single-cell, chemometrics), never an abstract one.
- **Connect to what they already did:** lean on the *statistics & data science*
  and *Python* courses (distributions, `lm`, data wrangling) as the familiar
  ground to build new math on — but introduce PCA, eigenvalues, and Markov chains
  as genuinely new, since no prior course covers them.
- Treat **linear algebra** as the single biggest hurdle for this cohort and budget
  time accordingly; build geometric intuition (pictures) before notation.
- Re-derive distributions they have only *used*, so Poisson/NB and the Bayesian
  posterior become things they understand, not invoke.
- Make every dependency on a prior programme course explicit and provide a linked
  refresher, so a stand-alone entry student can follow.
- The exam is an **individual written on-campus exam** — exercises must build
  by-hand fluency (solve a small system, multiply small matrices, compute a toy
  posterior), not only the ability to call the R function.
