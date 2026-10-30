# Airway figure for the bulk-rnaseq/ unit: raw vs shrunken fold changes (lfcShrink).
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd bulk-rnaseq && Rscript make-airway-figs.R
#
# Needs DESeq2, apeglm and airway (see Install R). Same analysis as exercise R4.
# Writes fig06-airway-shrinkage.png and prints the numbers quoted on the slide.

suppressMessages({ library(DESeq2); library(airway) })

data(airway)
airway$dex <- relevel(airway$dex, ref = "untrt")
dds <- DESeqDataSet(airway, design = ~ cell + dex)
dds <- dds[rowSums(counts(dds)) >= 10, ]
dds <- DESeq(dds, quiet = TRUE)
res <- results(dds, name = "dex_trt_vs_untrt")
shr <- lfcShrink(dds, coef = "dex_trt_vs_untrt", type = "apeglm", quiet = TRUE)

for (b in list(c(0, 10), c(10, 100), c(100, Inf))) {
  k <- res$baseMean > b[1] & res$baseMean <= b[2]
  cat(sprintf("baseMean %g-%g: %d genes; |LFC| > 2: raw %d, shrunken %d\n", b[1], b[2], sum(k),
              sum(abs(res$log2FoldChange[k]) > 2, na.rm = TRUE), sum(abs(shr$log2FoldChange[k]) > 2, na.rm = TRUE)))
}

called <- !is.na(res$padj) & res$padj < 0.05
png("fig06-airway-shrinkage.png", width = 1800, height = 800, res = 200)
par(mfrow = c(1, 2), mar = c(4.5, 4.8, 2.4, 1), las = 1, mgp = c(3.2, 0.8, 0))
for (k in 1:2) {
  v <- list(res$log2FoldChange, shr$log2FoldChange)[[k]]
  v <- pmax(pmin(v, 5.9), -5.9)                          # clip to the plot, as plotMA does
  o <- order(called)                                     # called genes drawn on top
  plot(res$baseMean[o], v[o], log = "x", pch = 16, cex = 0.35, xaxt = "n", ylim = c(-6, 6),
       col = adjustcolor(ifelse(called[o], "#bc4749", "grey35"), 0.5),
       xlab = "baseMean (log axis)", ylab = "log2 fold change",
       main = c("raw: results()", "shrunken: lfcShrink()")[k], font.main = 1)
  at <- 10^(0:5)
  axis(1, at = at, labels = format(at, scientific = FALSE, big.mark = ","))
  abline(h = 0, col = "#2a6f97", lwd = 1.5)
  if (k == 1) legend("topright", c("padj < 0.05", "not called"), pch = 16,
                     col = c("#bc4749", "grey35"), bty = "n", cex = 0.8)
}
invisible(dev.off())
