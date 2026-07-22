# Slide-by-slide image audit — Quantitative biology (3MB00A)

**Goal:** evaluate every lecture slide for whether an explanatory image aids teaching; add an SVG where it does, otherwise record why not.

**Result:** 133 slides across 10 decks — **79 new SVG diagrams added**, 54 slides judged to need none.

Legend: ✅ = SVG added · — = no image needed


## day1 — Solving linear equation systems  ·  15 slides, 4 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Administrative learning-objectives slide. Pure prose bullet list of course goals; a diagram would be decorative, not explanatory. |
| 2 | A biology problem: what is in the mixture? | ✅ | `fig02-mixture-deconvolution.svg` | The core biology hook — a bulk sample as a hidden mixture whose known per-cell signatures let us recover the amounts — is a spatial/compositional idea that a picture conveys far better than the text plus table alone. |
| 3 | Turning the biology into equations | ✅ | `fig03-two-lines.svg` | Each linear equation is geometrically a line, and 'a solution' is their intersection — a strongly geometric idea. The slide only writes the equations algebraically, so a lines-meeting figure adds the missing intuition for what solving means. |
| 4 | The standard form Ax = b | ✅ | `fig04-matrix-vector-mult.svg` | The slide explicitly claims 'the first row of A times x reproduces the first equation' — the cell-by-cell formation of A·x is a matrix-arithmetic layout that a row-highlighting diagram teaches much more clearly than static bracket notation. |
| 5 | Strategy 1 — Substitution | — |  | Fully worked step-by-step algebraic manipulation (isolate x2, substitute, solve). The math is self-contained; a picture would not add explanatory value beyond the shown steps. |
| 6 | Always check your answer | — |  | A worked numeric verification (plug x1=3, x2=2 back in). Pure arithmetic check; no spatial or structural concept to visualize. |
| 7 | Strategy 2 — Gaussian elimination | — |  | Conceptual prose listing the allowed row operations. The concrete mechanics are visualized on the following augmented-matrix slides, so a diagram here would be redundant. |
| 8 | Gaussian elimination on our 2×2 | — |  | Fully worked numeric elimination with equations shown explicitly; the augmented-matrix figure on the next slide already visualizes the same transformation, so a picture here adds nothing. |
| 9 | The augmented matrix shorthand | ✅ | `fig09-augmented-triangular.svg` | The augmented-matrix bookkeeping and the 'staircase / upper-triangular' target shape are inherently spatial structures; highlighting the vertical bar, the created zero, and the shaded triangular region makes the goal concrete in a way plain text cannot, and this notation is reused for the 3x3 case. |
| 10 | Scaling up: a 3×3 system | — |  | Setup slide that just states the 3x3 equations and its augmented matrix; the elimination mechanics are visualized on the dedicated column-clearing slides that follow. |
| 11 | 3×3 elimination — clear column 1 | — |  | The slide already shows the before/after augmented matrices with the R3-2R1 arrow, fully visualizing the column-1 clearing. A separate SVG would duplicate the rendered matrices. |
| 12 | 3×3 elimination — clear column 2 | — |  | Same as the previous step: before/after augmented matrices with the R3+½R2 arrow are already shown, so the transformation is fully conveyed without an added diagram. |
| 13 | 3×3 — back-substitution | — |  | Fully worked bottom-up solve with aligned arrows and a numeric check. The upward flow is already evident from the aligned equations; a diagram would restate the same steps. |
| 14 | The same idea in R (preview) | — |  | Pure R console code slide (matrix/solve). Code and its printed output speak for themselves; no concept to diagram. |
| 15 | Summary | — |  | Prose recap of the four takeaways. Summary text only; a diagram would be decorative. |

## day2 — Deconvolution & solution spaces in R  ·  13 slides, 9 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Pure admin / learning-objectives slide (a bulleted list of what students will be able to do). A diagram would be decorative, not explanatory. |
| 2 | Recap: the deconvolution problem | ✅ | `fig02-deconvolution-system.svg` | The mixture-as-weighted-sum-of-signature-columns idea is inherently spatial and is the conceptual anchor of the whole deck; a labelled A·x=b picture teaches it far better than prose. |
| 3 | Building A and b in R | ✅ | `fig03-byrow-fill-order.svg` | The byrow fill-order gotcha is a spatial layout issue; showing the two fill paths and the resulting transpose makes the 'classic bug' concrete in a way the code alone cannot. |
| 4 | Solving with solve() | — |  | Pure R-console slide: run solve(A,b) then verify with A %*% x. It is a worked numeric example with input/output already shown; a diagram would only restate the arithmetic. |
| 5 | solve(A) alone gives the inverse | — |  | R-console slide contrasting solve(A,b) with solve(A) %*% b plus a prose caveat about the inverse. No geometric or structural content that a picture would clarify. |
| 6 | Three kinds of solution space | ✅ | `fig06-three-solution-spaces.svg` | The zero/one/infinite trichotomy is fundamentally geometric (how two lines intersect); a three-panel intersecting/parallel/coincident figure is the canonical teaching image for this theorem. |
| 7 | Case 1 — exactly one (well-determined) | ✅ | `fig07-case1-unique-intersection.svg` | Concrete geometric realisation of Case 1 with the slide's actual coefficients; seeing the two real lines meet at (3,2) reinforces the abstract 'exactly one' picture. |
| 8 | Case 2 — no solution (over-determined) | ✅ | `fig08-case2-no-common-point.svg` | The over-determined 'no solution' case is best shown as three lines that fail to meet at one point (a mismatch triangle); it makes the inconsistency visible and sets up the least-squares slide. |
| 9 | Case 3 — infinitely many (under-determined) | ✅ | `fig09-case3-coincident-line.svg` | The under-determined case is a spatial idea — two equations collapsing to one line with an infinite solution set; showing the coincident line with sample solution points conveys 'infinitely many' directly. |
| 10 | Detecting which case you are in | ✅ | `fig10-diagnosis-flowchart.svg` | This slide is a diagnostic decision procedure over dim/det/rank; a flowchart turns the scattered rules into a single follow-the-arrows recipe, which is more useful than the code list alone. |
| 11 | When there is no exact answer: least squares | ✅ | `fig11-least-squares-compromise.svg` | Least squares as the best-compromise point that minimises distance to inconsistent constraints is a geometric idea; placing (2.33,3.33) among the three lines with residual segments makes 'closest fit' concrete without needing the day-3 projection machinery. |
| 12 | A note for real deconvolution | ✅ | `fig12-fraction-simplex.svg` | Non-negativity plus sum-to-one defines a feasible region (the probability simplex); showing that an unconstrained solution can fall outside it explains WHY constrained tools are needed, which prose states but does not make visible. |
| 13 | Summary | — |  | Prose recap of the lecture plus a forward pointer to day 3. All concepts already have their own figures earlier; a summary diagram would be redundant/decorative. |

## day3 — Vectors, dot product & projection  ·  13 slides, 10 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/overview slide listing the day's topics. A diagram here would be decorative, not explanatory; each concept gets its own illustrated slide later. |
| 2 | A gene-expression profile is a vector | ✅ | `fig02-profile-vector.svg` | The central claim 'a sample IS a vector' is inherently spatial; showing the 3-gene profile as one arrow in gene-space makes the data/arrow duality concrete in a way the numbers alone cannot. |
| 3 | Vectors as arrows | ✅ | `fig03-vector-arrow-2d.svg` | Purely geometric idea (components as movement instructions along axes); an arrow-with-staircase picture directly teaches what the numbers mean spatially. |
| 4 | Adding vectors = combining profiles | ✅ | `fig04-vector-addition.svg` | The tip-to-tail rule is a geometric construction; a picture of the two arrows chained head-to-tail and the resultant is far clearer than the componentwise sum text. |
| 5 | Scaling a vector | ✅ | `fig05-vector-scaling.svg` | Stretch/shrink/flip along a fixed direction line is a spatial claim; showing the collinear arrows makes 'scaling changes length not direction' visually obvious. |
| 6 | Length of a vector (the norm) | ✅ | `fig06-norm-pythagoras.svg` | The norm is literally the hypotenuse of a right triangle; drawing the 3-4-5 triangle grounds the Pythagoras formula geometrically. |
| 7 | The dot product | ✅ | `fig07-dot-product-mechanics.svg` | A cell-by-cell layout showing matching components multiplied then summed to one scalar clarifies the mechanical definition before geometry is introduced. |
| 8 | What does the dot product mean? | ✅ | `fig08-dot-product-angle.svg` | This is the conceptual climax linking dot product to angle; three side-by-side geometric cases (aligned/perpendicular/opposite) make the sign-and-magnitude behavior intuitive. |
| 9 | Cosine similarity: comparing two samples | ✅ | `fig09-cosine-similarity.svg` | Depth-invariance is the biological payoff; showing two collinear arrows of different length with angle 0 makes 'same direction, different magnitude' visible and explains why cosine beats Euclidean distance here. |
| 10 | Orthogonality = a right angle | ✅ | `fig10-orthogonality.svg` | Orthogonality is a geometric right-angle statement; the perpendicular-arrows picture ties the zero dot product to the visible 90-degree angle. |
| 11 | Projection: the shadow of one vector on another | ✅ | `fig11-projection.svg` | Projection is explicitly framed as a shadow cast by a light; the drop-a-perpendicular picture with the orthogonal residual is essential to teach the geometry the formula encodes. |
| 12 | Why projection matters biologically | — |  | Prose slide connecting projection to regression/deconvolution, batch-effect removal, and PCA. These are conceptual/textual links, and the underlying geometric projection is already illustrated on the previous slide; a new diagram would repeat it. |
| 13 | Summary | — |  | One-slide cheat-sheet table of formulas already fully conveyed by the table; a diagram would just re-draw figures shown earlier in the deck. |

## day4 — Matrices as transformations  ·  13 slides, 8 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/orientation slide: prose roadmap of the day plus a %*% link. No single concept to illustrate; a diagram would be decorative. |
| 2 | A matrix is a function on vectors | ✅ | `fig02-matrix-as-function.svg` | Introduces the matrix-as-function idea geometrically; a before/after point makes 'stretch x by 2, y by 3' concrete. |
| 3 | How to multiply Ax by hand | ✅ | `fig03-row-dot-vector.svg` | Shows the cell-by-cell mechanics of how each output entry is formed as a row-vector dot product, which pure equations flatten. |
| 4 | The same product, columns view | ✅ | `fig04-columns-view.svg` | The columns interpretation is inherently geometric (weighted sum of column vectors reaching the output); tip-to-tail addition explains the column space idea. |
| 5 | Matrix–vector product in R | — |  | Pure R-console slide: code, printed output, and two gotcha bullets (%*% vs *, byrow). No concept beyond the previous two diagrams; a picture adds nothing. |
| 6 | The identity matrix — "do nothing" | — |  | Trivial concept (I leaves vectors unchanged) shown with a tiny equation and diag(2) R output; a diagram of an unchanged point would be decorative. |
| 7 | Scaling matrices | ✅ | `fig07-scaling-square.svg` | Diagonal scaling is a spatial per-axis stretch; seeing points move (x out, y in) teaches it far better than the numeric matrix output. |
| 8 | Rotation matrices | ✅ | `fig08-rotation-90.svg` | Rotation is a canonical geometric transformation; the arc from x-axis onto y-axis and preserved length are the whole point and demand a picture. |
| 9 | Reading the columns of a transformation | ✅ | `fig09-columns-are-axis-images.svg` | The core takeaway — each column is where a unit axis lands — is spatial and maps matrix columns to arrows on a grid; a frequent exam idea best shown visually. |
| 10 | Composing transformations = multiplying matrices | ✅ | `fig10-order-matters.svg` | Non-commutativity of composition is abstract until you see the same input reach different outputs under the two orderings; two geometric panels make it undeniable. |
| 11 | Putting it together: transform a small dataset | ✅ | `fig11-pipeline-square.svg` | Capstone geometric pipeline; although the R code plots it live, a clean static before/after figure on the slide anchors the 'one %*% chain moves every point' idea and doesn't depend on running code. |
| 12 | Design / contrast matrices: a biology aside | — |  | Recognition-only prose slide connecting to limma/DESeq2; the equation y ≈ X beta plus text conveys the analogy, and a bespoke diagram of a design matrix is beyond the slide's stated 'not by hand' scope. |
| 13 | Summary | — |  | Cheat-sheet table plus Day 5 preview; it recaps concepts already illustrated on earlier slides, so an image would be redundant. |

## day5 — Eigenvalues & eigenvectors  ·  15 slides, 7 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/roadmap slide listing what the lecture will cover. Pure prose overview; a diagram would be decorative, not explanatory. The concepts it previews get their own illustrated slides later. |
| 2 | A biology picture first | ✅ | `fig02-gene-cloud.svg` | Core geometric/spatial idea: a tilted data cloud with a long and short principal axis. This is exactly the covariance-cloud-plus-principal-axis picture the guidelines flag as a strong candidate, and it anchors the whole lecture. |
| 3 | Most vectors get rotated | ✅ | `fig03-rotate-vs-scale.svg` | Purely geometric: vectors as arrows, the contrast between rotation (generic inputs) and pure scaling (the special direction). This is the conceptual heart of the lecture and hard to convey with text alone. |
| 4 | The definition: A v = lambda v | — |  | Definitional slide stating A v = lambda v with etymology. The single geometric instance it references, (1,1) -> (3,3), is already fully illustrated on the preceding 'Most vectors get rotated' slide (fig03). Adding another arrow diagram here would duplicate that picture. |
| 5 | The whole line is special | ✅ | `fig05-eigenline.svg` | Spatial idea that an eigenvector is really a line (a direction) through the origin, not one specific arrow. Showing multiple scaled arrows collinear on one line makes the abstract 'up to scale' point concrete and pre-empts the R-normalisation confusion the notes warn about. |
| 6 | Finding eigenvalues: the characteristic equation | — |  | Algebraic derivation moving terms to one side to reach det(A - lambda I) = 0. The reasoning is symbolic (nonzero null space implies singular implies det zero); a diagram would not clarify the algebraic manipulation, and the determinant mechanics get their own illustrated slide next. |
| 7 | The determinant of a 2x2 | ✅ | `fig07-det-2x2.svg` | A matrix-arithmetic layout: the criss-cross ad−bc rule and the diagonal-only subtraction of lambda are exactly the mechanical facts students must memorise, and both are inherently spatial cell-position rules that a labelled diagram teaches far better than prose. |
| 8 | Worked example: eigenvalues by hand | — |  | A fully worked numeric algebra example (expand, collect, factor the quadratic to lambda = 3, 1). It is a step-by-step pen-and-paper computation where a picture adds nothing; the geometric meaning of lambda=3 is already shown on fig03. |
| 9 | Two sanity checks (trace and determinant) | — |  | Arithmetic verification (sum of eigenvalues = trace, product = det). It is a numeric check-your-work slide; a diagram would be decorative. |
| 10 | Finding the eigenvector for each lambda | — |  | Worked linear-algebra computation: substitute lambda=3, form the singular matrix, read v2 = v1, pick (1,1). Pure symbolic row-reduction; the resulting eigenvector direction is illustrated geometrically on later slides (fig03/fig11). |
| 11 | The second eigenvector | ✅ | `fig11-orthogonal-eigvecs.svg` | The slide's punchline is a geometric one — the two eigenvectors are perpendicular. Drawing (1,1) and (1,-1) with an explicit right-angle marker makes the orthogonality visible and sets up the symmetric-matrix theorem, which the dot-product number alone does not convey. |
| 12 | Symmetric matrices are special | — |  | States the definition A = A^T and the spectral theorem (real eigenvalues, orthogonal eigenvectors). The orthogonality payoff is already illustrated on the preceding slide (fig11), and the theorem itself is a stated fact rather than a spatial construction, so a diagram would add little. |
| 13 | Why biologists care: covariance is symmetric | ✅ | `fig13-covariance-pca.svg` | The biological payoff: covariance cloud with eigenvectors as the principal axes and eigenvalues as variance along each. Guidelines flag covariance-cloud-plus-principal-axis as a strong candidate. Distinct from fig02 (pure intuition) because here the axes are explicitly the eigenvectors of the labelled covariance matrix with arrow length encoding eigenvalue/variance. |
| 14 | Special cases & gotchas | ✅ | `fig14-gotchas.svg` | Two strongly geometric edge cases: a pure rotation leaves no direction fixed (complex eigenvalues), while a scalar-multiple-of-identity fixes every direction (repeated eigenvalue). Showing the rotated-vs-scaled arrows side by side makes these contrasting behaviours concrete and reinforces the opening rotation-vs-scaling theme. |
| 15 | Summary | — |  | A recap table serving as an exam cheat-sheet plus a Day 6 preview. It condenses already-illustrated concepts into text; a diagram would be redundant with the figures earlier in the deck. |

## day6 — Eigen-decomposition in R  ·  12 slides, 7 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/framing slide ("yesterday concept, today the tool"). Bulleted prose roadmap with no spatial or geometric idea to depict; a diagram would be decorative. |
| 2 | The function: eigen() | — |  | Pure R-console input/output slide showing the shape of eigen()'s returned list ($values, $vectors). The column structure of the eigenvectors is taught geometrically on the very next slide, so a picture here would duplicate that. |
| 3 | Reading $vectors: columns, not rows | ✅ | `fig03-columns-not-rows.svg` | The core teaching point is an indexing/layout distinction (column vs row) that is inherently spatial; showing the matrix with columns boxed and colour-linked to their eigenvalues, next to the arrows those columns represent, prevents the most common reading mistake far better than prose. |
| 4 | Scale and sign are not unique | ✅ | `fig04-sign-arbitrary.svg` | "v and -v are the same eigen-direction" is a purely geometric fact; drawing both arrows on one line through the origin makes the abstract statement "defined up to a scalar including -1" immediately obvious and defuses the panic when R's sign differs from the student's hand answer. |
| 5 | Verify the eigen relation | ✅ | `fig05-Av-equals-lambda-v.svg` | The verification A v = lambda v is checked numerically in the code, but the reason it matters is geometric: A leaves the eigenvector's direction fixed and only scales it. The contrast with a rotated non-eigenvector turns the two matching number columns into the visual meaning of an eigenvector. |
| 6 | Reconstruct A = V Lambda V^{-1} | ✅ | `fig06-eigendecomposition-pipeline.svg` | The slide's own bullet describes A as a three-step pipeline (change to eigen-coords -> scale each axis -> change back); a staged grid/ellipse transformation diagram is the natural way to show that composition, making the "aha" that A is just diagonal scaling in the eigen-basis concrete rather than symbolic. |
| 7 | Symmetric shortcut: A = V Lambda V^T | ✅ | `fig07-orthonormal-eigenvectors.svg` | The reason the transpose can replace the inverse is that the eigenvectors are perpendicular and unit length — an orthogonality fact that is much clearer shown as two right-angled unit arrows than asserted in text, and it visually motivates why crossprod(V) equals the identity. |
| 8 | Biology: covariance of two genes | ✅ | `fig08-covariance-cloud.svg` | The slide gives the covariance matrix as numbers but its meaning is spatial: diagonal entries are the spread along each gene axis and the off-diagonal is the tilt of the cloud. A labelled scatter cloud connects each matrix entry to a visible feature, which the numeric table alone cannot do, and sets up the eigenvector arrow on the next slide. |
| 9 | The leading eigenvector = main axis of variation | ✅ | `fig09-leading-eigenvector-axis.svg` | This is the payoff slide: it literally instructs plotting the cloud and drawing a red arrow along the leading eigen-direction. A static rendering of that scatter-plus-arrow (with the perpendicular minor axis and the two eigenvalues as axis variances) is the single most important geometric picture of the lecture and cannot be conveyed by the code listing alone. |
| 10 | Foreshadowing PCA (not today) | — |  | This slide is a concept-mapping table (eigen term -> PCA name) plus a boundary-setting paragraph. The spatial idea (eigenvector = axis of variation) is already fully depicted on the previous slide; here the content is a lexical mapping best carried by the existing table. |
| 11 | Numerical notes & gotchas | — |  | A bulleted list of practical R warnings (all.equal vs ==, sign arbitrariness, ordering, complex output, symmetric flag). These are language/numerical caveats with no geometric or spatial structure to draw; a diagram would be decorative. |
| 12 | Summary | — |  | Cheat-sheet table of tasks mapped to R commands plus a Day 7 preview line. Pure reference text/table; nothing to illustrate. |

## day7 — Markov chains  ·  12 slides, 9 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/overview slide listing the day's roadmap. Pure prose bullets; a diagram would be decorative, not explanatory. |
| 2 | A biological process that "forgets" | ✅ | `fig02-markov-forgets.svg` | The Markov property is inherently a spatial/temporal idea (current position vs ignored history); a sequence-walk picture makes 'memorylessness' concrete far better than prose. |
| 3 | States and the Markov property | ✅ | `fig03-markov-chain-graph.svg` | The formal conditional-independence definition is abstract; a chain graph with a struck-out past->future edge visualises exactly what the equation asserts and complements (rather than repeats) the sequence-walk on the prior slide. |
| 4 | The transition matrix P | ✅ | `fig04-from-row-to-col.svg` | The from-row/to-column convention is the single most confused point of the day; a highlighted row/column intersection tied to a small from->to arrow makes the spatial convention unmistakable. |
| 5 | Rows sum to 1 | ✅ | `fig05-rows-sum-to-one.svg` | Linking a matrix row to the fan of arrows leaving a single state visually explains WHY rows (not columns) sum to 1, reinforcing the row convention and the total-probability intuition. |
| 6 | The state diagram | ✅ | `fig06-two-state-diagram.svg` | The slide currently shows only crude ASCII art of the state diagram; a proper node-and-arrow SVG is the canonical visual for a Markov chain and greatly clarifies self-loops and directed transitions. |
| 7 | State as a distribution vector | ✅ | `fig07-distribution-vector.svg` | The 'fraction of a pool of walkers' bridge from a single walker to a distribution vector is spatial; showing pools plus bar charts for the two concrete example vectors makes the abstraction tangible. |
| 8 | One step: x_{t+1} = x_t P | ✅ | `fig08-vector-matrix-step.svg` | How a row-vector-times-matrix product is formed cell by cell (dotting with each column) is the core exam skill; a layout with arrows sweeping across columns makes the mechanics explicit in a way the formula alone does not. |
| 9 | Many steps: powers of P | ✅ | `fig09-powers-chain.svg` | Repeated application / composition is best shown as an unrolled chain with the concrete evolving values (1,0)->(0.9,0.1)->(0.86,0.14), making the equivalence of stepping forward vs raising P to a power visible; distinct from the single-step mechanics of the prior slide. |
| 10 | Estimating P from data: count transitions | ✅ | `fig10-count-transitions.svg` | The estimation recipe is a spatial sliding-window process mapping adjacent pairs into matrix cells; showing the window sweep feeding the count matrix teaches the mechanic more clearly than the formula, and covers the visual so the next (numeric) slide can skip one. |
| 11 | Estimating P: a tiny worked count | — |  | This is a fully worked numeric example: the six transitions are listed, the exact count matrix N is displayed, and the row-A normalisation (1/3, 2/3, 0, 0) is spelled out. The visual counting mechanic is already carried by fig10 on the preceding slide, so a diagram here would only duplicate it. |
| 12 | Summary | — |  | Recap table condensing the day's facts (states, Markov property, p_ij convention, row sums, one step, powers, estimation). It is a text cheat-sheet and every concept has its own diagram earlier, so no new picture is needed. |

## day8 — Powers, convergence & stationary distribution  ·  13 slides, 7 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/overview slide listing the day's agenda in prose and bullets. A diagram would be decorative, not explanatory. |
| 2 | Recap: one step is x_{t+1} = x_t P | ✅ | `fig02-dna-markov-diagram.svg` | The transition matrix is far more intuitive as a labeled state diagram; it makes the CpG dip (C->G = 0.05) visible as a structural feature of the chain, which drives the non-uniform equilibrium seen later. |
| 3 | Taking powers: %*% not ^ | ✅ | `fig03-matmul-vs-elementwise.svg` | The single most common student bug this week is P^2 vs P %*% P; a side-by-side layout of dot-product formation versus per-entry squaring makes the difference concrete in a way console output alone does not. |
| 4 | A package shortcut: expm | — |  | Pure R tooling/convenience slide about the %^% operator; the concept (matrix power) is already illustrated on the previous slide, so a diagram adds nothing. |
| 5 | Watch it converge | ✅ | `fig05-convergence-trajectories.svg` | Convergence 'forgetting the start' is the central idea of the day and is inherently visual; a trajectory plot showing two very different starts collapsing onto the same equilibrium lines conveys it far better than a table of printed numbers. |
| 6 | The stationary distribution pi | ✅ | `fig06-fixed-point.svg` | The abstract idea that pi is a fixed point of the map 'multiply by P' — a point the step leaves alone while other points are drawn toward it — is a spatial/dynamical concept that a fixed-point sketch makes concrete. |
| 7 | Why pi is an eigenvector (recall Day 6) | ✅ | `fig07-left-right-eigenvector.svg` | The left-vs-right eigenvector distinction (why R needs eigen(t(P))) is the slide's key subtlety and is clarified by visually contrasting a row-vector-times-matrix with the transposed matrix-times-column-vector, showing the shapes line up. |
| 8 | Finding pi (a) by power iteration | — |  | Pure R-console slide implementing the power-iteration loop; the underlying convergence idea is already visualized in fig05, so a diagram here would be redundant. |
| 9 | Finding pi (b) via eigen(t(P)) | — |  | Pure R-console slide walking through eigen(t(P)) code; the left/right-transpose concept it relies on is already diagrammed in fig07, so no additional image is needed. |
| 10 | Two methods, same answer | — |  | A comparison table plus confirming R output; the side-by-side table already conveys the contrast and a diagram would be decorative. |
| 11 | Biology: equilibrium base composition | ✅ | `fig11-equilibrium-composition-bars.svg` | A bar chart makes the equilibrium composition and the biologically meaningful result (G depleted below uniform because of the CpG dip) immediately readable, connecting the abstract pi vector to base frequencies. |
| 12 | Caveats: when is there a unique pi? | ✅ | `fig12-irreducible-aperiodic-counterexamples.svg` | The irreducibility and aperiodicity conditions are best understood as graph properties; drawing the periodic 2-cycle and the disconnected-two-group chain makes the abstract failure modes concrete and contrasts them with the well-behaved all-positive DNA matrix. |
| 13 | Summary | — |  | Cheat-sheet summary table plus a text preview of HMMs; the table format already organizes the takeaways and a diagram would be decorative. |

## day9 — Hidden Markov models  ·  15 slides, 10 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/overview slide listing learning objectives and notation. Pure prose roadmap; a diagram would be decorative, not explanatory. |
| 2 | Recap: a visible Markov chain (Day 7) | ✅ | `fig02-visible-markov-bases.svg` | A transition matrix alone is abstract; a state-diagram makes the Markov property spatial (arrows between letter-states) and visually cements the key recap point that in a visible chain the state IS the observed letter, setting up the contrast with hidden states. |
| 3 | The biology: where is the CpG island? | ✅ | `fig03-cpg-island-track.svg` | This is the core biological motivation (CpG-island map). A genome track with a visible letter row and a dashed hidden-label row above it makes the two-layer visible/hidden split concrete and memorable in a way the ASCII underline cannot. |
| 4 | Why the visible chain is not enough | ✅ | `fig04-ambiguous-emission.svg` | The key idea is emission ambiguity — two states producing the same symbol. A picture of two states converging on one 'G' with thick vs thin arrows makes 'a single letter cannot reveal the state' immediate and intuitive. |
| 5 | Two layers: the generative picture | ✅ | `fig05-two-layer-generative.svg` | The two-layer generative picture is THE mental model of the whole topic and is explicitly a strong image candidate. A clean SVG of the unrolled chain (across = transitions, down = emissions) replaces the cramped ASCII art and clearly distinguishes the hidden top row from the visible bottom row. |
| 6 | The four ingredients of an HMM | ✅ | `fig06-hmm-anatomy.svg` | Shows the anatomy of the model as a single structural picture, tying the four listed ingredients to concrete graphical elements (transition arrows = A, emission arrows to symbols = B, start arrows = pi) and highlighting that A is states-by-states while B is states-by-symbols. Distinct from the time-unrolled fig05 by being the compact parameter structure. |
| 7 | A tiny concrete 2-state HMM | ✅ | `fig07-concrete-2state.svg` | Turns the two raw matrices (A and B) into a labelled state diagram with actual numbers, making the 'sticky' self-transitions (0.8/0.7) and the GC-loving vs uniform emission profiles visible at a glance. This is the running example, so a canonical picture pays off across this and later slides. |
| 8 | The generative story, step by step | ✅ | `fig08-generation-trace.svg` | Visualises the six-step generative recipe as an annotated trellis path where each edge carries its probability, making the alternation start -> emit -> move -> emit tangible and setting up the product formula on the next slide. |
| 9 | Probability of ONE path with its emissions | — |  | This slide is already a fully worked numeric example with an annotated product formula (underbraces tagging each factor as start/emit/move) and the final value 0.003840. The alternating factor structure it teaches is already shown pictorially by the generation-trace figure on the previous slide (fig08); a second diagram would be redundant. |
| 10 | Three classic problems | — |  | An organizational list mapping three questions (likelihood/decoding/learning) to three algorithms (forward/Viterbi/Baum-Welch). A diagram would just re-box the same three-item list decoratively; the trellis ideas behind likelihood and decoding get dedicated figures on the next two slides. |
| 11 | Why summing over paths matters (likelihood) | ✅ | `fig11-likelihood-trellis-sum.svg` | The distinction between one path's probability and the likelihood (a sum over all paths) is abstract in symbols. A trellis with several highlighted alternative paths all producing the same G C A makes the exponential 2^3 = 8 count and the need to sum concrete and visual. |
| 12 | Decoding: the most likely path (Viterbi) | ✅ | `fig12-viterbi-best-path.svg` | Viterbi decoding is inherently a path-through-a-trellis picture and an explicit strong candidate. Highlighting the single best path and bracketing its run of H states as a 'predicted CpG island' visually connects the algorithm to the concrete genome annotation it produces. |
| 13 | Learning: where do A, B, π come from? | ✅ | `fig13-baum-welch-em-loop.svg` | Baum-Welch is an iterative EM loop ('guess states, re-estimate, repeat'), which is naturally a cyclic diagram. A loop picture conveys the alternation and the local-optimum/initialisation caveats far better than prose bullets, and contrasts it with the one-shot counting route for labelled data. |
| 14 | HMM vs visible Markov chain — the contrast | — |  | This slide is already a structured comparison table (states, parameters, what you see, core question, biology) that lays out the contrast cleanly. The visual distinction it draws — observed states vs hidden states behind emissions — is already delivered by the two-layer figure (fig05) and the ambiguous-emission figure (fig04); another diagram would duplicate them. |
| 15 | Summary | — |  | Prose recap of the four take-home beats plus a pointer to Day 10. Summary/wrap-up slide; every concept it names already has its own figure earlier in the deck, so a diagram would be decorative. |

## day10 — HMMs in R (CpG islands)  ·  12 slides, 8 images

| # | Slide | Img | File | Rationale |
|--:|-------|:---:|------|-----------|
| 1 | About this lecture | — |  | Admin/learning-objectives intro slide. Pure prose roadmap of what the day covers; a diagram would be decorative, not explanatory. |
| 2 | Recap and today's tool | ✅ | `fig02-hmm-pipeline.svg` | The slide only gives a text table pairing tasks to functions; a spatial flowchart shows the actual dataflow (model -> simulated data -> the three inference branches) which the table cannot convey and orients the whole day. |
| 3 | Building the model with initHMM | ✅ | `fig03-hmm-state-diagram.svg` | Geometric/structural Markov + emission picture: the concrete two-state transition graph with self-loops plus per-state base distributions makes the abstract A, B, pi matrices tangible in a way the code listing does not. |
| 4 | Simulating sequence with simHMM | ✅ | `fig04-generative-story.svg` | Classic HMM two-layer generative picture; showing hidden-state chain on top emitting the observed base sequence below directly illustrates 'simHMM returns both the true states and the emitted data', which the code output only lists as vectors. |
| 5 | Likelihood with forward | ✅ | `fig05-forward-trellis.svg` | The forward matrix is inherently a states-by-position trellis; drawing the lattice with arrows into the final column visually explains why the likelihood comes from log-sum-exp of the last column, which the code alone leaves abstract. |
| 6 | Decoding with viterbi: the island map | ✅ | `fig06-viterbi-island-map.svg` | This is the biological payoff slide; a decoding path shaded into island segments plus the rle run-length breakdown turns the abstract label vector into the CpG-island map the lecture is teaching. |
| 7 | Learning with baumWelch | ✅ | `fig07-baumwelch-em.svg` | Shows EM as a transformation from a uniform initial parameter guess to the learned GC-heavy structure; the visual matrix before/after conveys 'learning from unlabelled data' more concretely than the code that only prints the results. |
| 8 | Pitfalls of learning | ✅ | `fig08-local-optima.svg` | Local optima are an inherently geometric idea (a bumpy likelihood surface); a landscape with two peaks and EM climbing the nearest one explains the 'run several inits' advice far better than the bullet text. |
| 9 | How many hidden states? | ✅ | `fig09-model-selection.svg` | The core tension (likelihood monotonically rising vs a penalised score that has a minimum) is a curve-shape argument; a two-curve plot conveys why raw likelihood cannot choose the number of states, which prose bullets state but do not show. |
| 10 | From toy to real genomes | — |  | Prose bullets of practical advice (symbols, scale, validation, more states). No single geometric/spatial concept to depict; a diagram would be decorative rather than teaching a mechanism. |
| 11 | Summary | — |  | Text recap of points already illustrated earlier in the deck (pipeline, decoding, pitfalls, model selection). A new figure would duplicate earlier diagrams. |
| 12 | Where this leads | — |  | Forward-looking prose linking to PCA, Bayesian stats, and single-cell blocks. No concrete quantitative concept to diagram on this slide; purely narrative. |
