# Figures for the vae/ unit ("Variational autoencoders", extra material).
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd vae && Rscript make-vae-figs.R
#
# Writes fig02, fig04 and fig05 (the diagrams fig01, fig03 and fig06 are separate,
# hand-written SVG files) and prints the numbers quoted on the slides.
# Base R only. Colours follow the ctmc/ figures. The "decoder" here is the same
# hand-written function as in exercise.qmd, not a trained network.

ink   <- "#1b2a3a"   # text and lines
cBlue <- "#2a6f97"
cRed  <- "#bc4749"
cGrn  <- "#6a994e"
cGrey <- "#8d99ae"

fig <- function(file, w, h, expr) {
  svg(file, width = w, height = h, family = "Helvetica")
  par(mar = c(4.2, 4.6, 1.6, 1), las = 1, mgp = c(2.8, 0.7, 0), col.axis = ink, col.lab = ink, fg = ink,
      cex.axis = 1.1, cex.lab = 1.2)
  expr
  invisible(dev.off())
}

decoder <- function(z1, z2 = 0) {
  c(stem1 = 20 / (1 + exp(4 * z1)),  stem2 = 12 / (1 + exp(4 * z1)),
    prog1 = 15 * exp(-z1^2),         prog2 = 9 * exp(-z1^2),
    ery1  = 20 / (1 + exp(-4 * z1)), ery2  = 12 / (1 + exp(-4 * z1)),
    cyc   = 10 / (1 + exp(-3 * z2)), house = 8)
}
phi <- 0.2
gcol <- c(cBlue, cBlue, cGrn, cGrn, cRed, cRed, "#e9a23b", cGrey)

## ---- fig02: PCA as a linear autoencoder (2 genes -> 1 number -> 2 genes) ------
set.seed(4)
u  <- c(0.8, 0.6)
s  <- rnorm(60, 0, 2.2); e <- rnorm(60, 0, 0.5)
X  <- cbind(s * u[1] - e * u[2], s * u[2] + e * u[1])   # centred cloud along u
x  <- c(3, 1)
sc <- sum(x * u)
xh <- sc * u
cat(sprintf("fig02: cell x = (3, 1); score = %.1f; decoded = (%.1f, %.1f); squared error = %.2f\n",
            sc, xh[1], xh[2], sum((x - xh)^2)))
fig("fig02-pca-autoencoder.svg", 6.4, 5.0, {
  par(mar = c(4.2, 4.6, 0.8, 0.8))
  plot(X, pch = 19, col = adjustcolor(cGrey, 0.6), xlim = c(-5, 5), ylim = c(-4, 4), asp = 1,
       xlab = "gene A (centred)", ylab = "gene B (centred)")
  abline(h = 0, v = 0, col = "#dddddd")
  abline(0, u[2] / u[1], col = cBlue, lwd = 2.5)
  text(-4.6, -3.9, "PC1", col = cBlue, font = 2, cex = 1.2, adj = c(0, 0))
  segments(x[1], x[2], xh[1], xh[2], col = cRed, lwd = 2.5, lty = 2)
  points(x[1], x[2], pch = 21, bg = ink, col = "white", cex = 2.2)
  points(xh[1], xh[2], pch = 21, bg = cBlue, col = "white", cex = 2.2)
  text(x[1] + 0.25, x[2] - 0.15, "cell x = (3, 1)", adj = c(0, 1), cex = 1.1)
  text(xh[1] - 0.3, xh[2] + 0.3, "decoded = 3.0 × PC1\n= (2.4, 1.8)", adj = c(1, 0), col = cBlue, cex = 1.1)
  text(3.3, 1.75, "error", col = cRed, adj = c(0, 0.5), cex = 1.1)
})

## ---- fig04: one latent point, many cells ---------------------------------------
z  <- c(-1, 0)
m  <- decoder(z[1], z[2])
set.seed(5)
cells <- t(replicate(12, rnbinom(length(m), mu = m, size = 1 / phi)))
cat("fig04: decoder means at z = (-1, 0):", round(m, 1), "\n")
cat("fig04: first 3 sampled cells:\n"); print(cells[1:3, ])
fig("fig04-one-z-many-cells.svg", 10, 4.0, {
  layout(matrix(1:2, 1), widths = c(1.15, 1))
  par(mar = c(5.2, 4.6, 2.2, 1))
  ymax <- max(cells) + 2
  bp <- barplot(m, col = adjustcolor(gcol, 0.55), border = NA, ylim = c(0, ymax), las = 2,
                ylab = "count", main = "")
  mtext("expected counts at z, and 12 cells", side = 3, line = 0.6, cex = 1.15, col = ink, font = 2)
  set.seed(6)
  for (i in 1:12) points(bp + runif(length(m), -0.28, 0.28), cells[i, ], pch = 19, cex = 0.9,
                         col = adjustcolor(ink, 0.65))
  par(mar = c(5.2, 5.2, 2.2, 1))
  pal <- colorRampPalette(c("white", "#08306b"))(40)
  image(1:8, 1:12, t(log1p(cells)), col = pal, zlim = c(0, log1p(40)), axes = FALSE, xlab = "", ylab = "")
  axis(1, 1:8, names(m), las = 2, tick = FALSE)
  axis(2, 1:12, paste("cell", 1:12), las = 1, tick = FALSE, cex.axis = 0.9)
  mtext("the same 12 cells (dark = high)", side = 3, line = 0.6, cex = 1.15, col = ink, font = 2)
})

## ---- fig05: a walk along z1 -------------------------------------------------------
zz <- seq(-2, 2, length.out = 200)
M  <- t(sapply(zz, decoder))
path <- seq(-2, 2, length.out = 9)
set.seed(7)
one <- t(sapply(path, function(a) rnbinom(8, mu = decoder(a), size = 1 / phi)))
cat("fig05: decoded at z1 = -1, 0, 1 (stem1, prog1, ery1):\n")
print(round(t(sapply(c(-1, 0, 1), decoder))[, c("stem1", "prog1", "ery1")], 2))
fig("fig05-walk.svg", 9, 4.2, {
  par(mar = c(4.4, 4.6, 0.8, 13))
  plot(NA, xlim = c(-2, 2), ylim = c(0, 40), xlab = expression("latent coordinate " * z[1] * "  (walking from left to right)"),
       ylab = "count")
  for (g in c("stem1", "prog1", "ery1")) {
    k <- match(g, colnames(M))
    lines(zz, M[, k], col = gcol[k], lwd = 3)
    points(path, one[, k], pch = 19, col = adjustcolor(gcol[k], 0.8), cex = 1.1)
  }
  par(xpd = NA)
  legend(2.2, 40, c("stem gene", "progenitor gene", "erythroid gene", "", "line: decoded mean", "dots: one sampled", "cell per step"),
         col = c(cBlue, cGrn, cRed, NA, ink, ink, NA), lwd = c(3, 3, 3, NA, 3, NA, NA), pch = c(NA, NA, NA, NA, NA, 19, NA),
         bty = "n", cex = 1.0, text.col = ink)
})
