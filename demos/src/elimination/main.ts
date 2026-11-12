// Gaussian elimination on the augmented matrix [A | b], one row operation at a time:
// the operation in words and notation (R3 ← R3 − 2·R1), the matrix before and after with
// the pivot, the changed row and the new 0 highlighted, and the row arithmetic written out.
// Then back-substitution equation by equation and a check in the original equations.
// Exact fractions; row swaps when a pivot spot holds 0; explains "no solution" (0 = c)
// and "infinitely many" (0 = 0, a free unknown). Sizes 2×2 to 4×4, unknowns x, y, z, w.
// Auto-mounts on <div data-demo="elimination">. Optional: data-a="1 1 1 0 2 1 2 1 1"
// (A row by row) and data-b="6 7 8"; fractions like 1/3 are allowed.
import { autoMount } from "../lib/ui";
import { mountRowOps } from "../lib/rowopsui";

autoMount("elimination", host => mountRowOps(host, "solve"));
