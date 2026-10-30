# Figures for the bulk-rnaseq/ unit ("Bulk RNA-seq with DESeq2").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd bulk-rnaseq && Rscript make-bulk-figs.R
#
# Base R only (no DESeq2 needed). Writes figNN-*.png and prints the numbers
# quoted on the slides. fig01 and fig05 are hand-made SVGs, not made here;
# fig06 (airway, needs DESeq2) is made by make-airway-figs.R.
# All data are simulated: sequencing = drawing reads at random from a bag of
# RNA fragments, with sample.int(..., replace = TRUE, prob = p).

set.seed(1)

## ---- plotting helpers ------------------------------------------------------
fig <- function(file, w, h, expr, mfrow = c(1, 1)) {
  png(file, width = w, height = h, res = 200)
  par(mfrow = mfrow, mar = c(4.5, 4.8, 2.4, 1), las = 1, mgp = c(3.2, 0.8, 0))
  expr
  invisible(dev.off())
}
draw <- function(p, N) tabulate(sample.int(length(p), N, replace = TRUE, prob = p), length(p))
logaxis <- function(side, at = 10^(-1:4)) axis(side, at = at, labels = format(at, scientific = FALSE, drop0trailing = TRUE))
gene_col <- c(A = "#2a6f97", B = "#6a994e", C = "#e9c46a", D = "#bc4749")

## ---- fig02: the composition trap ----------------------------------------------
# Sample 1: A 500, B 200, C 200, D 100 molecules (per 1000).
# Sample 2: gene A goes up 3-fold, nothing else changes. Both sequenced to 1000 reads.
mol <- cbind(s1 = c(A = 500, B = 200, C = 200, D = 100),
             s2 = c(A = 1500, B = 200, C = 200, D = 100))
reads <- sweep(mol, 2, colSums(mol), "/") * 1000
print(reads)
fig("fig02-composition.png", 1800, 800, mfrow = c(1, 2), {
  par(mar = c(3, 4.8, 3, 6), xpd = NA)
  for (k in 1:2) {
    M <- list(mol, reads)[[k]]
    b <- barplot(M, col = gene_col, border = "white", names.arg = c("sample 1", "sample 2"),
                 ylim = c(0, 2000), width = 0.7, space = 0.6,
                 ylab = c("molecules in the tube", "reads (1000 per sample)")[k],
                 main = c("what is in the tube", "what we sequence")[k], font.main = 1)
    for (j in 1:2) {
      mid <- cumsum(M[, j]) - M[, j] / 2
      big <- M[, j] >= 90
      text(b[j], mid[big], paste(rownames(M), round(M[, j]))[big], col = "white", cex = 0.8, font = 2)
      if (any(!big)) text(b[j] + 0.4, mid[!big], paste(rownames(M), round(M[, j]))[!big], adj = 0, cex = 0.8, font = 2)
    }
  }
})

## ---- fig03: median of ratios ----------------------------------------------------
# 3000 genes, sample 2 sequenced twice as deep. 60 genes truly go up 5-fold in
# sample 2 and are highly expressed, so they take a big fraction of the reads.
G  <- 3000
p1 <- exp(rnorm(G, 0, 1.5)); p1 <- p1 / sum(p1)
up <- order(p1, decreasing = TRUE)[seq(5, 300, by = 5)]       # 60 well-expressed genes
p2 <- p1; p2[up] <- p2[up] * 5; p2 <- p2 / sum(p2)
x1 <- draw(p1, 5e5); x2 <- draw(p2, 1e6)
ok <- x1 > 0 & x2 > 0
rat <- x2[ok] / x1[ok]
med <- median(rat); tot <- sum(x2) / sum(x1)
cat(sprintf("fig03: %d genes with no zero; median ratio %.2f; total-count ratio %.2f\n",
            sum(ok), med, tot))
cat(sprintf("fig03: fraction of sample-2 reads from the 60 up genes: %.2f\n", sum(x2[up]) / sum(x2)))
fig("fig03-median-of-ratios.png", 1600, 800, {
  h <- hist(log2(rat), breaks = seq(-6, 9, by = 0.125), plot = FALSE)
  plot(h, col = "grey75", border = "white", xlim = c(-3, 6), main = "", xaxt = "n",
       xlab = "ratio sample 2 / sample 1, one value per gene (log axis)", ylab = "number of genes")
  axis(1, at = -3:6, labels = c("1/8", "1/4", "1/2", 1, 2, 4, 8, 16, 32, 64))
  abline(v = log2(med), col = "#2a6f97", lwd = 3)
  abline(v = log2(tot), col = "#bc4749", lwd = 3, lty = 2)
  text(log2(med), max(h$counts) * 0.95, sprintf("median ratio = %.2f", med),
       pos = 2, col = "#2a6f97", font = 2)
  text(log2(tot), max(h$counts) * 0.8, sprintf("ratio of totals = %.2f", tot),
       pos = 4, col = "#bc4749", font = 2)
  arrows(3.6, max(h$counts) * 0.35, 2.9, max(h$counts) * 0.1, length = 0.08, col = "grey30")
  text(3.9, max(h$counts) * 0.45, "60 genes that\nreally went up", cex = 0.85, col = "grey30")
})

## ---- fig04: the replicate MA-plot fan ---------------------------------------------
# Two replicates, same RNA (same p for every gene), same depth. Every difference
# is pure counting noise.
G  <- 5000
p  <- exp(rnorm(G, 0, 2)); p <- p / sum(p)
N  <- 1e6
x  <- draw(p, N); y <- draw(p, N)
m  <- (x + y) / 2
both <- x > 0 & y > 0
lfc <- log2(y / x)
cat(sprintf("fig04: expected counts range %.2f to %.0f; %d of %d genes have a zero in one replicate\n",
            min(N * p), max(N * p), sum(!both & m > 0), sum(m > 0)))
top <- order(abs(lfc[both]), decreasing = TRUE)[1:10]
cat("fig04: the 10 largest |log2 ratio| (both counts > 0):\n")
print(data.frame(x = x[both][top], y = y[both][top], log2ratio = round(lfc[both][top], 2)))
for (b in list(c(1, 5), c(90, 110), c(900, 1100)))
  cat(sprintf("fig04: genes with mean count %d-%d: sd of log2 ratio %.2f\n", b[1], b[2],
              sd(lfc[both & m >= b[1] & m <= b[2]])))
fig("fig04-replicate-fan.png", 1700, 900, {
  plot(m[both], lfc[both], log = "x", pch = 16, cex = 0.45, col = adjustcolor("grey25", 0.5),
       xlim = c(0.5, 3e4), ylim = c(-5, 5), xaxt = "n",
       xlab = "mean count of the gene (log axis)", ylab = "log2(replicate 2 / replicate 1)")
  logaxis(1, 10^(0:4))
  abline(h = 0, col = "#2a6f97", lwd = 2)
  mm <- 10^seq(-0.3, 4.5, length.out = 200)
  band <- 2 * sqrt(2 / mm) / log(2)                       # n +- sqrt(n) for both counts
  lines(mm, band, lty = 2, col = "#bc4749", lwd = 2); lines(mm, -band, lty = 2, col = "#bc4749", lwd = 2)
  zx <- m[!both & m > 0]
  points(zx, ifelse(x[!both & m > 0] == 0, 4.9, -4.9), pch = c(2, 6)[1 + (x[!both & m > 0] > 0)],
         cex = 0.5, col = "#bc4749")
  text(2e4, 4.3, "no true change\nfor any gene", adj = 1, cex = 0.85)
  legend("bottomright", c("n \u00b1 \u221an rule (2 \u00d7 the typical spread)", "one replicate has 0 reads"),
         lty = c(2, NA), pch = c(NA, 2), col = "#bc4749", lwd = 2, bty = "n", cex = 0.8)
})
