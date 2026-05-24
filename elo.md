# Expected Learning Outcomes

A second-cycle course (**3MB00A**, 7.5 ECTS) on the mathematical and statistical
methods used in modern bioinformatics. Each topic pairs a method with a biological
problem that motivates it: students never learn a technique in the abstract.

See [audience.md](audience.md) for the assumed background and
[courseplan.md](courseplan.md) for the formal syllabus.

## Overall course outcome

By the end of the course, a student should be able to take a quantitative
bioinformatics problem — solving a linear system, reducing the dimensionality of
an expression matrix, modelling counts with the right distribution, or reasoning
about a process as a Markov chain — and **set it up, solve it in R, and judge
whether the model is valid** for the biology at hand.

## Outcomes from the syllabus

The official syllabus groups outcomes into three categories.

### Knowledge and understanding

A student can:

- explain statistical distributions and where they arise in biological data;
- distinguish Bayesian from frequentist approaches;
- describe the solution space of a system of linear equations (unique, none, infinitely many);
- explain what a latent space is and why dimensional reduction is useful.

### Skills and abilities

A student can:

- solve systems of linear equations (by hand for small systems, in R for larger ones);
- formulate a biological problem as a Markov chain and analyse its behaviour;
- analyse large-scale data using latent-space methods (PCA / OLS);
- apply chemometrics to a biological dataset.

### Judgement and approach

A student can:

- assess the validity of a mathematical model for a biological system — state its
  assumptions and recognise when they break.

## Day-by-day outcomes (working draft)

> This is a planning scaffold, not a contract. Days will shift, merge, and split
> as the method ↔ biology pairings become clearer. Topics below are taken from the
> syllabus content; the ordering is a first proposal.

### Linear algebra I — vectors and matrices
- Read vectors and matrices as data; matrix–vector and matrix–matrix products in R (`%*%`).
- **Bio examples:** an expression matrix as samples × genes; design matrices.

### Linear algebra II — solving linear systems
- Solve `Ax = b`; describe the solution space (unique / none / infinitely many); `solve()`.
- **Bio examples:** deconvolution; mass-balance / stoichiometry.

### Markov chains
- Transition matrices, state evolution, stationary distributions via power iteration.
- **Bio examples:** sequence models; cell-state transitions.

### Eigenvalues and dimensional reduction (PCA)
- Eigenvalues/eigenvectors; covariance; PCA via `prcomp`; reading a latent space.
- **Bio examples:** PCA of bulk and single-cell expression data.

### Regression and OLS
- Ordinary least squares as projection; `lm`; relating OLS to the linear-algebra view.
- **Bio examples:** dose–response; expression vs. covariates.

### Statistical distributions for counts
- Poisson and negative binomial; overdispersion; when each applies.
- **Bio examples:** RNA-seq and single-cell count models.

### Bayesian statistics
- Bayes' theorem; prior / likelihood / posterior; Bayesian vs. frequentist framing.
- **Bio examples:** small-sample estimation; shrinkage.

### Applications — chemometrics & single-cell
- Putting the methods together on real biological datasets.

## Assessment

Per the syllabus: an **individual written on-campus exam**. Pass (G) requires
passing the exam; distinction (VG) requires distinction-level performance. Up to
10 % bonus may be awarded for participation. The self-paced exercises in this
material exist to build the by-hand and by-code fluency the exam tests.
