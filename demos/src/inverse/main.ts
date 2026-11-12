// The inverse by Gauss–Jordan elimination on [A | I], one row operation at a time:
// zeros below the diagonal, then from the bottom pivot up: scale the pivot to 1 and clear
// above it, until [I | A⁻¹]. Ends with A⁻¹ and the check A · A⁻¹ = I. Exact fractions,
// row swaps when a pivot spot holds 0, and "no inverse" when a zero row appears on the
// left. No determinants (bonus material in this course). Shares its code with "elimination".
// Auto-mounts on <div data-demo="inverse">. Optional: data-a="2 1 1 3" (A row by row).
import { autoMount } from "../lib/ui";
import { mountRowOps } from "../lib/rowopsui";

autoMount("inverse", host => mountRowOps(host, "inverse"));
