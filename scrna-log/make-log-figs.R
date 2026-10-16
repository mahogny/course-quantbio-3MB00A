# Figures for the scrna-log/ unit ("Log and pseudolog transforms").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd scrna-log && Rscript make-log-figs.R
#
# Writes figNN-*.png and prints the numbers quoted on the slides.
# All data are simulated (negative-binomial counts).

set.seed(1)

## ---- simulated single-cell counts ------------------------------------------
# Same code as in the exercise. 400 cells of two types (T, B), 300 genes:
#  - 280 "background" genes, same mean in both types, means from 0.01 to 30 UMIs
#  -   5 very high genes (ribosomal/mitochondrial-like), mean 150-400, same in both types
#  -  15 marker genes: mean 4 in one type, 0.3 in the other (8 T markers, 7 B markers)
type <- rep(c("T", "B"), each = 200)                 # 400 cells: 200 T, 200 B
lib  <- rlnorm(400, 0, 0.35)                         # capture efficiency per cell
gene_mean <- c(exp(seq(log(0.01), log(30), length.out = 280)),   # 280 background genes
               150, 200, 250, 300, 400)                           # 5 very high genes
marker <- rbind(matrix(rep(c(4, 0.3), c(8, 7)), 200, 15, byrow = TRUE),   # T cells
                matrix(rep(c(0.3, 4), c(8, 7)), 200, 15, byrow = TRUE))   # B cells
mu <- cbind(outer(lib, gene_mean), lib * marker)     # expected count, cells x genes
X  <- matrix(rnbinom(length(mu), mu = mu, size = 5), nrow = 400)   # negative binomial counts
colnames(X) <- c(paste0("bg", 1:280), paste0("hi", 1:5), paste0("mk", 1:15))
cat(sprintf("fraction zeros: %.2f\n", mean(X == 0)))

# library-size normalize (scale factor 10,000, as Seurat), then log1p
tot  <- rowSums(X)
N    <- X / tot * 10000
L    <- log1p(N)
cat(sprintf("median total counts per cell: %.0f\n", median(tot)))
cat(sprintf("max normalized value: %.0f; share of total variance from 5 high genes: raw %.2f, log1p %.2f\n",
            max(N), sum(apply(N, 2, var)[281:285]) / sum(apply(N, 2, var)),
            sum(apply(L, 2, var)[281:285]) / sum(apply(L, 2, var))))

## ---- PCA raw vs log1p --------------------------------------------------------
pc_raw <- prcomp(N)
pc_log <- prcomp(L)
sep <- function(p) { s <- p$x[, 1]; abs(mean(s[type == "T"]) - mean(s[type == "B"])) / sd(s) }
cat(sprintf("PC1 separation (|mean diff| / sd): raw %.2f, log1p %.2f\n", sep(pc_raw), sep(pc_log)))
top <- function(p) names(sort(abs(p$rotation[, 1]), decreasing = TRUE))[1:5]
cat("top PC1 genes raw:", top(pc_raw), "\n")
cat("top PC1 genes log:", top(pc_log), "\n")

## ---- plotting helpers ------------------------------------------------------
pal <- c(T = "#0072B2", B = "#D55E00")
fig <- function(file, w, h, expr, mfrow = c(1, 1)) {
  png(file, width = w, height = h, res = 200)
  par(mfrow = mfrow, mar = c(4.5, 4.8, 2.4, 1), las = 1, mgp = c(3.2, 0.8, 0))
  expr
  dev.off()
}

## ---- fig02: gene means span orders of magnitude --------------------------------
gm <- colMeans(X)                                     # raw UMIs per cell
cat(sprintf("gene means range %.3f to %.0f (ratio %.0f)\n", min(gm), max(gm), max(gm) / min(gm)))
cat(sprintf("share of all UMIs from the 5 high genes: %.2f\n", sum(X[, 281:285]) / sum(X)))
fig("fig02-dynamic-range.png", 1800, 650, mfrow = c(1, 2), {
  stripchart(gm, method = "jitter", jitter = 0.3, pch = 16, cex = 0.6, col = "grey40",
             xlab = "mean UMIs per cell", main = "linear axis", font.main = 1)
  stripchart(gm, method = "jitter", jitter = 0.3, pch = 16, cex = 0.6, col = "grey40", log = "x",
             xlab = "mean UMIs per cell (log axis)", main = "log axis", font.main = 1,
             xaxt = "n")
  axis(1, at = 10^(-2:3), labels = c("0.01", "0.1", "1", "10", "100", "1000"))
})

## ---- fig03: mean-variance, raw vs log1p ------------------------------------------
v_raw <- apply(X, 2, var); v_log <- apply(L, 2, var); gmN <- colMeans(N)
m_log <- colMeans(L)
gcol <- ifelse(grepl("^mk", colnames(X)), "#009E73", ifelse(grepl("^hi", colnames(X)), "#CC79A7", "grey40"))
fig("fig03-mean-var.png", 1800, 700, mfrow = c(1, 2), {
  plot(gm, v_raw, log = "xy", pch = 16, cex = 0.7, col = gcol, xaxt = "n", yaxt = "n",
       xlab = "gene mean (UMIs per cell)", ylab = "gene variance", main = "raw counts", font.main = 1)
  axis(1, at = 10^(-2:3), labels = c("0.01", "0.1", "1", "10", "100", "1000"))
  axis(2, at = 10^seq(-2, 6, by = 2), labels = c("0.01", "1", "100", "1e4", "1e6"))
  abline(0, 1, lty = 2)
  text(10, 1, "variance = mean\n(Poisson)", adj = 0, cex = 0.8)
  legend("topleft", c("background", "very high", "cell-type markers"), pch = 16,
         col = c("grey40", "#CC79A7", "#009E73"), bty = "n", cex = 0.85)
  plot(gmN, v_log, log = "x", pch = 16, cex = 0.7, col = gcol, xaxt = "n",
       xlab = "gene mean (normalized, scale 10,000)", ylab = "variance of log1p", main = "after log1p", font.main = 1)
  axis(1, at = 10^(-2:3), labels = c("0.01", "0.1", "1", "10", "100", "1000"))
})
cat(sprintf("raw-count variance: very high genes %.0f-%.0f, markers %.1f-%.1f\n",
            min(v_raw[281:285]), max(v_raw[281:285]), min(v_raw[286:300]), max(v_raw[286:300])))
cat(sprintf("log1p variance: very high genes %.2f-%.2f, markers %.2f-%.2f\n",
            min(v_log[281:285]), max(v_log[281:285]), min(v_log[286:300]), max(v_log[286:300])))

## ---- fig04: PCA raw vs log1p -----------------------------------------------------
fig("fig04-pca.png", 1800, 760, mfrow = c(1, 2), {
  for (k in 1:2) {
    p  <- list(pc_raw, pc_log)[[k]]
    ve <- round(100 * p$sdev[1:2]^2 / sum(p$sdev^2))
    plot(p$x[, 1], p$x[, 2], pch = 16, cex = 0.6, col = adjustcolor(pal[type], 0.7),
         xlab = sprintf("PC1 (%d%%)", ve[1]), ylab = sprintf("PC2 (%d%%)", ve[2]),
         main = c("PCA on normalized counts", "PCA on log1p(normalized)")[k], font.main = 1)
    if (k == 1) legend("topright", c("T cells", "B cells"), pch = 16, col = pal, bty = "n")
  }
})

## ---- fig05: pseudocount choice ---------------------------------------------------
fig("fig05-pseudocount.png", 1500, 800, {
  x <- seq(0, 20, by = 0.05)
  cs <- c(0.1, 1, 10); cl <- c("#D55E00", "black", "#0072B2")
  plot(NA, xlim = c(0, 20), ylim = c(-3.5, 5), xlab = "count x", ylab = expression(log[2](x + c)))
  for (i in 1:3) {
    lines(x, log2(x + cs[i]), col = cl[i], lwd = 2.5)
    points(0:3, log2(0:3 + cs[i]), col = cl[i], pch = 16)
  }
  abline(h = 0, col = "grey80")
  legend("bottomright", c("c = 0.1", "c = 1 (log1p)", "c = 10"), col = cl, lwd = 2.5, bty = "n")
})

## ---- fig06: plotting a gene with zeros (ggplot2) ------------------------------------------
library(ggplot2)
d <- data.frame(type = factor(type, levels = c("T", "B")), expr = N[, "mk1"])
cat(sprintf("mk1: %d of %d cells are 0 (T: %d, B: %d)\n", sum(d$expr == 0), nrow(d),
            sum(d$expr == 0 & d$type == "T"), sum(d$expr == 0 & d$type == "B")))
base <- ggplot(d, aes(type, expr, colour = type)) +
  geom_boxplot(outlier.shape = NA, fill = NA, colour = "grey30", width = 0.6) +
  geom_jitter(width = 0.25, height = 0, size = 0.9, alpha = 0.6) +
  scale_colour_manual(values = pal, guide = "none") + theme_bw(base_size = 13) + xlab(NULL)
p1 <- base + ggtitle("linear axis") + ylab("normalized expression")
p2 <- base + scale_y_log10() + ggtitle("scale_y_log10()") + ylab(NULL)
p3 <- ggplot(d, aes(type, log1p(expr), colour = type)) +
  geom_boxplot(outlier.shape = NA, fill = NA, colour = "grey30", width = 0.6) +
  geom_jitter(width = 0.25, height = 0, size = 0.9, alpha = 0.6) +
  scale_colour_manual(values = pal, guide = "none") + theme_bw(base_size = 13) + xlab(NULL) +
  scale_y_continuous(breaks = log1p(c(0, 1, 3, 10, 30, 100)), labels = c(0, 1, 3, 10, 30, 100)) +
  ggtitle("log1p(expr)") + ylab(NULL)
medB <- median(d$expr[d$type == "B"])
medB_log10 <- 10^suppressWarnings(ggplot_build(p2))$data[[1]]$middle[2]
cat(sprintf("B-cell median of mk1: true %.2f; boxplot on scale_y_log10 shows %.2f (zeros dropped)\n",
            medB, medB_log10))
png("fig06-plot-zeros.png", width = 1800, height = 700, res = 200)
grid::grid.newpage()
grid::pushViewport(grid::viewport(layout = grid::grid.layout(1, 3)))
for (i in 1:3) suppressWarnings(print(list(p1, p2, p3)[[i]],
                                      vp = grid::viewport(layout.pos.row = 1, layout.pos.col = i)))
invisible(dev.off())
