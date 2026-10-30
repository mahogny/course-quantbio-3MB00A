# Canvas bonus quizzes — plan (2026-10-18)

## Goal

Auto-corrected Canvas quizzes that give bonus points and nudge students to work
through every lecture. Questions are taken from (or very close to) the units'
exercises, so they add little extra work. Simple: multiple choice or "enter a
number". Where a unit is about R, the question may ship a short R snippet that
the student runs.

## Decisions (user, 2026-10-18)

- **5 quizzes, one per week, 5 questions each. Pass = 3 of 5.**
- **Public pages show questions only, never answers.** One unlisted page per
  week (not in the sidebar, `search: false`).
- **Answers are never checked in** (the repo is public on GitHub). They live in
  `canvas-quiz/private/` (git-ignored), together with the QTI zips.

## Guessing

With 3 of 5 to pass, random guessing must not work. Each quiz has **at least
3 numerical-answer questions** (guess success ≈ 0), and multiple-choice
questions get **5–6 options** with plausible distractors (typical mistakes).
With 2 MC of 5 options and 3 numeric, passing by guessing is essentially
impossible; even 5 MC of 5 options gives only P(≥3/5) ≈ 6%.

## Which units each question covers

Week 5 has five units: one question each. Week 3 has four, so covariates
gets two questions. Weeks 1, 2 and 4 have more, so some questions cover two or
three units (an R unit with its concept unit,
or neighbouring topics):

| Week | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| 1 | solving-systems (+ warm-ups) | solving-systems-r | vectors-projection | matrix-transforms + matrix-images | compensation + polar |
| 2 | eigen | eigen-r + markov + markov-r (stationary distribution) | pca | pca-r + pca-scree | fourier |
| 3 | covariates (Xβ) | least-squares | covariates | confounding | covariates-r (limma) |
| 4 | penalized-intro + ridge-lasso-enet | crossval | bayes-intro | bayes-fitting + error-models | hierarchical + penalty-bayes-link |
| 5 | nonlinear | scrna-intro | scrna-umap | vae | scrna-annotation |

A combined question takes its item from one of the units (ideally one that
needs both). Adjust after the week-1 pilot.

## Rules for each question

1. **Source:** an item from the unit's exercise (or its warm-up exercises), from
   the first half — not the last, hardest items. Record the item in the private
   file (e.g. `vectors-projection/exercise.qmd B2`). The question may be the item
   itself with new numbers, or the item verbatim.
2. **Type:** Canvas *numerical answer* (exact value ± margin) or *multiple
   choice* (5–6 options). No free text — everything auto-graded.
3. **By-hand units:** small whole numbers, one or two steps.
4. **R units:** a self-contained snippet of at most ~6 lines, base R or packages
   from the install page, deterministic (`set.seed`), runs in seconds. No Stan /
   brms (slow to compile) and no DESeq2 runs: for those units use a by-hand or
   reading question instead.
5. **Plain maths:** Canvas renders LaTeX only through its equation editor, so
   question text uses plain text / Unicode (x², √, θ, matrices as rows
   `[2 1; 1 3]`) or small images; keep formulas minimal.
6. **No exam claims** in the question text.
7. **Verified:** every answer is computed by a script, never typed by hand.

## Files

Tracked (public, no answers):
- `quiz/week1.qmd` … `quiz/week5.qmd` — unlisted question pages (stem, snippet,
  options), `search: false`, not in the sidebar.
- `canvas-quiz/build.py` — generator; contains no answers.

Not tracked (`canvas-quiz/private/`, git-ignored):
- `questions.yml` — single source of truth: `id, week, units, source, type,
  stem, r_snippet, choices + correct | answer + margin, explanation`.
- `check.R` — runs every snippet and re-derives every answer; fails loudly on a
  mismatch.
- `weekN-qti.zip` — QTI 1.2, Canvas flavour (the importer supports
  `multiple_choice_question` and `numerical_question` with margins; see
  canvas-lms `gems/plugins/qti_exporter`, fixture `canvas/numerical.xml`).
  Import via *Course settings → Import course content → QTI .zip*.
- `weekN-answers.md` — review copy with answers.

Canvas settings (set there): attempts allowed, when correct answers are shown,
points per question.

## Steps

1. Write week 1 (5 questions) as a pilot; review together; adjust style.
2. Write weeks 2–5; every answer verified by `check.R`.
3. Generate pages + QTI zips; test-import one zip into a Canvas sandbox course.
4. Re-run `check.R` whenever an exercise changes.
