# Expected Learning Outcomes

A second-cycle course (**3MB00A**, 7.5 ECTS) on the mathematical and statistical
methods used in modern bioinformatics. Each topic pairs a method with a biological
problem that motivates it: students never learn a technique in the abstract.

See [audience.md](https://github.com/mahogny/course-quantbio-3MB00A/blob/main/audience.md) (on GitHub) for the assumed background and
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

- explain where common statistical distributions come from, and where they arise
  in biological data;
- contrast Bayesian and frequentist approaches;
- describe the solution space of a linear system, including over- and
  underdetermined systems (unique, none, infinitely many);
- explain memoryless (Markov) processes;
- distinguish linear from nonlinear systems;
- explain what a latent space is and why dimensional reduction is useful.

### Skills and abilities

A student can:

- solve systems of linear equations (by hand for small systems, in R for larger ones);
- formulate a biological problem as a Markov chain and analyse its behaviour;
- analyse large-scale data in latent spaces, with linear (PCA / OLS) and nonlinear
  methods;
- build hierarchical models with alternative distributions, in particular Poisson
  and negative binomial;
- apply chemometrics and single-cell methods to large datasets.

### Judgement and approach

A student can:

- assess the validity of a mathematical model for a biological system — state its
  assumptions and recognise when they break.

## Assessment

Per the syllabus: an **individual written on-campus exam**. Pass (G) requires
passing the exam; distinction (VG) requires distinction-level performance. Up to
10 % bonus may be awarded for participation. The self-paced exercises in this
material exist to build the by-hand and by-code fluency the exam tests.
