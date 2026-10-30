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

## ---- fig07: volcano plot ---------------------------------------------------------
# x: shrunken log2 fold change (the size), y: -log10(padj) (the evidence).
sym <- rowData(dds)$gene_name
ok  <- !is.na(res$padj)
big <- ok & res$padj < 0.05 & abs(shr$log2FoldChange) > 1
cat(sprintf("volcano: %d genes tested, %d with padj < 0.05, %d of them also |LFC| > 1 (%d up, %d down)\n",
            sum(ok), sum(called), sum(big), sum(big & shr$log2FoldChange > 0), sum(big & shr$log2FoldChange < 0)))
y   <- -log10(res$padj)
lab <- match(c("SPARCL1", "DUSP1", "GPX3", "FKBP5", "ZBTB16", "ALOX15B", "DSTN"), sym)   # top hits, known targets, a small sure change
pos <- c(4, 2, 4, 4, 4, 2, 2)
print(data.frame(gene = sym[lab], lfc = round(shr$log2FoldChange[lab], 2), padj = signif(res$padj[lab], 2)))
png("fig07-airway-volcano.png", width = 1500, height = 950, res = 200)
par(mar = c(4.5, 4.8, 1, 1), las = 1, mgp = c(3.2, 0.8, 0))
col <- ifelse(big, "#bc4749", ifelse(called, "#e9a03b", "grey55"))
o <- which(ok)[order((called + big)[ok])]          # called genes drawn on top
plot(shr$log2FoldChange[o], y[o], pch = 16, cex = 0.4, col = adjustcolor(col[o], 0.6),
     xlim = c(-6, 12), xlab = "log2 fold change (shrunken), dexamethasone vs untreated",
     ylab = "-log10(padj)")
abline(h = -log10(0.05), lty = 2, col = "grey30"); abline(v = c(-1, 1), lty = 3, col = "grey30")
text(shr$log2FoldChange[lab], y[lab], sym[lab], pos = pos, cex = 0.7, offset = 0.3)
legend("topright", c("padj < 0.05 and |LFC| > 1", "padj < 0.05", "not called"), pch = 16,
       col = c("#bc4749", "#e9a03b", "grey55"), bty = "n", cex = 0.75)
invisible(dev.off())
