# Design principles

The principles below govern how we build course material in this repository. They
exist to keep us honest as the material scales — every new exercise, lecture, and
chapter should be checked against them.

See [audience.md](audience.md) for who we are designing for, [elo.md](elo.md) for
what we are trying to teach, and [courseplan.md](courseplan.md) for the formal
syllabus.

## 1. Method ↔ biology pairing

Every mathematical or statistical method is introduced together with a biological
problem that motivates it. We do not teach a technique in the abstract first and
apply it to biology later.

- The unit of design is the **pairing**, not the day.
- Day-by-day structure is a working draft, not a contract: shift, merge, or split
  days as the pairings become clearer.

## 2. Show the math *and* the code

Every formula is accompanied by R that computes it, and every code result is tied
back to the math it implements. A student should never see a derivation without
being able to run it, nor a function call without knowing what it computes.

- Prefer base R and small, transparent packages over black boxes for the *first*
  encounter with a method (`%*%`, `solve`, `eigen`, `prcomp`, `lm`), then point to
  the production-grade Bioconductor tool.
- Build geometric and probabilistic *intuition* (pictures, small worked numbers)
  before notation.

## 3. Exercises over stretch goals

We prefer a good number of core exercises that every student is expected to
complete over a few exercises with long optional "going further" tails.

- The audience is broad. Stretch goals systematically benefit students who are
  already ahead and widen the spread rather than building shared competence.
- A short, neutral **"Where this leads"** note at the end of an exercise is fine —
  it tells students what we defer and to which day, without inviting them to
  attempt it now.

## 4. Linked hints over named hints

Every key function, concept, or distribution named in a hint links to its
documentation — the R help page, the package vignette, or a canonical reference —
so a student never has to guess search terms to finish a core exercise.

## 5. By-hand fluency, because the exam is by hand

Examination is an individual written on-campus exam. Core exercises must therefore
build the ability to *do the small case with pen and paper* — solve a 2×2 system,
multiply small matrices, compute a posterior on a toy example — not only to call
the R function that does it at scale.

## 6. Honest about what we defer and what we assume

When an exercise uses a simplification we will later replace (a tiny dataset, a
hand-rolled solver instead of the optimised one, a frequentist shortcut before the
Bayesian treatment), say so plainly and name the day on which the proper treatment
arrives. Students should always know what is a stepping stone and what is the real
thing.
