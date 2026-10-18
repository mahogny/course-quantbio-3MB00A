# Figures for the compensation/ unit ("Compensation & spectral unmixing").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd compensation && Rscript make-comp-figs.R
#
# Most data are simulated; the simulation code is the same as on the slides and
# in the exercise. fig03 uses one real FCS file, flowcore-0877408774.B08.fcs
# (a FACSCalibur sample shipped as example data with the Bioconductor package
# flowCore, Artistic-2.0), read with the small reader below so that flowCore
# itself is not needed.

## ---- the student setup (same code as on the slides / in the exercise) ----

set.seed(1)
make_pop <- function(n, fitc, pe) {               # true dye amounts, one cell per COLUMN
  rbind(FITC = rlnorm(n, log(fitc), 0.3), PE = rlnorm(n, log(pe), 0.3))
}
true <- cbind(make_pop(600,  100,  100),          # unstained
              make_pop(400, 3000,  100),          # FITC+
              make_pop(400,  100, 2000),          # PE+
              make_pop(200, 3000, 2000))          # FITC+ PE+
group <- rep(c("unstained", "FITC+", "PE+", "FITC+ PE+"), c(600, 400, 400, 200))

S <- matrix(c(1,    0.02,                         # rows = detectors, columns = dyes
              0.25, 1   ), nrow = 2, byrow = TRUE,
            dimnames = list(c("FITC det", "PE det"), c("FITC", "PE")))
noise <- function(n) matrix(rnorm(2 * n, 0, 30), nrow = 2)   # detector noise
measured <- S %*% true + noise(ncol(true))

comp <- solve(S) %*% measured                     # compensation

## ---- single-stained control: estimate the spillover ------------------------

ctrl <- S %*% rbind(FITC = rlnorm(500, log(3000), 0.5), PE = 0) + noise(500)
fit  <- lm(ctrl[2, ] ~ ctrl[1, ])
slope <- unname(coef(fit)[2])

## ---- similar dyes (near-singular S) ----------------------------------------

S2 <- matrix(c(1,   0.9,
               0.9, 1  ), nrow = 2, byrow = TRUE)
measured2 <- S2 %*% true + noise(ncol(true))
comp2 <- solve(S2) %*% measured2

## ---- numbers used in the text ----------------------------------------------

med <- function(m, g) round(apply(m[, group == g], 1, median))
cat("det(S) =", det(S), " solve(S) =\n"); print(round(solve(S), 3))
cat("FITC+ median, measured:", med(measured, "FITC+"), " compensated:", med(comp, "FITC+"), "\n")
cat("PE+ median, measured:", med(measured, "PE+"), " compensated:", med(comp, "PE+"), "\n")
cat("spillover slope from control:", round(slope, 3), "\n")
cat("det(S2) =", det(S2), "\n"); print(round(solve(S2), 2))
sdu <- function(m) round(apply(m[, group == "unstained"], 1, sd))
cat("unstained sd: true", sdu(true), " comp with S", sdu(comp), " comp with S2", sdu(comp2), "\n")
under <- solve(matrix(c(1, 0.02, 0.15, 1), 2, byrow = TRUE)) %*% measured
over  <- solve(matrix(c(1, 0.02, 0.35, 1), 2, byrow = TRUE)) %*% measured
cat("FITC+ PE median: under", med(under, "FITC+")[2], " over", med(over, "FITC+")[2], "\n")

## ---- plotting helpers ------------------------------------------------------

pal <- c("unstained" = "grey55", "FITC+" = "#009E73", "PE+" = "#D55E00", "FITC+ PE+" = "#7B3294")

fig <- function(file, w, h, expr, mfrow = c(1, 1)) {
  png(file, width = w, height = h, res = 200)
  par(mfrow = mfrow, mar = c(4.8, 4.8, 2.2, 1), las = 1, mgp = c(3.3, 0.8, 0))
  expr
  dev.off()
}

cells <- function(m, main, xlab = "FITC detector", ylab = "PE detector", lim = c(-500, 4500),
                  legend = FALSE) {
  plot(m[1, ], m[2, ], pch = 16, cex = 0.35, col = adjustcolor(pal[group], 0.6),
       xlim = lim, ylim = lim, asp = 1, xlab = xlab, ylab = ylab,
       main = main, font.main = 1, cex.main = 1.1)
  abline(h = 0, v = 0, col = "grey80")
  if (legend) legend("topright", names(pal), col = pal, pch = 16, bg = "white", cex = 0.8)
}

## ---- fig02: emission spectra and detector bands (schematic) ----------------

fig("fig02-spectra.png", 1500, 800, {
  wl <- 480:700
  em <- function(peak, w1, w2) ifelse(wl < peak, exp(-((wl - peak) / w1)^2), exp(-((wl - peak) / w2)^2))
  fitc <- em(520, 18, 45); pe <- em(578, 18, 35)
  plot(wl, fitc, type = "n", ylim = c(0, 1.12), xlab = "wavelength (nm)", ylab = "emitted light",
       main = "", yaxt = "n")
  rect(515, -1, 545, 2, col = adjustcolor("#009E73", 0.15), border = NA)
  rect(564, -1, 606, 2, col = adjustcolor("#D55E00", 0.15), border = NA)
  text(530, 1.08, "FITC detector", cex = 0.85, col = "#00664a")
  text(585, 1.08, "PE detector", cex = 0.85, col = "#a34200")
  polygon(c(564, wl[wl >= 564 & wl <= 606], 606), c(0, fitc[wl >= 564 & wl <= 606], 0),
          col = adjustcolor("#009E73", 0.45), border = NA)
  lines(wl, fitc, col = "#009E73", lwd = 3)
  lines(wl, pe, col = "#D55E00", lwd = 3)
  text(498, 0.6, "FITC", col = "#009E73", font = 2)
  text(640, 0.6, "PE", col = "#D55E00", font = 2)
  arrows(640, 0.42, 600, 0.2, length = 0.08, col = "grey20")
  text(645, 0.47, "FITC light in the PE detector\n= spillover", adj = 0, cex = 0.8)
  mtext("schematic", side = 3, adj = 1, line = 0.3, cex = 0.8, col = "grey40")
})

## ---- fig04: raw (uncompensated) data ---------------------------------------

fig("fig04-raw.png", 1700, 850, mfrow = c(1, 2), {
  cells(true, "true dye amounts", xlab = "FITC (true)", ylab = "PE (true)", legend = TRUE)
  cells(measured, "measured = S × true")
})

## ---- fig05: single-stained control ------------------------------------------

fig("fig05-control.png", 1100, 950, {
  plot(ctrl[1, ], ctrl[2, ], pch = 16, cex = 0.4, col = adjustcolor("#009E73", 0.6),
       xlab = "FITC detector", ylab = "PE detector", main = "FITC-only control",
       font.main = 1, cex.main = 1.1, xlim = c(0, 8000), ylim = c(-200, 2200))
  abline(fit, col = "black", lwd = 2)
  text(500, 1900, sprintf("slope = %.3f", slope), adj = 0, cex = 1)
})

## ---- fig06: before / after compensation ------------------------------------

fig("fig06-before-after.png", 1700, 850, mfrow = c(1, 2), {
  cells(measured, "before: measured")
  cells(comp, "after: solve(S) %*% measured", xlab = "FITC (compensated)", ylab = "PE (compensated)",
        legend = TRUE)
})

## ---- fig07: under- and over-compensation (exercise) -------------------------

fig("fig07-under-over.png", 1700, 850, mfrow = c(1, 2), {
  cells(under, "under-compensated (0.15)", xlab = "FITC", ylab = "PE")
  abline(h = median(comp[2, group == "unstained"]), lty = 2)
  cells(over, "over-compensated (0.35)", xlab = "FITC", ylab = "PE")
  abline(h = median(comp[2, group == "unstained"]), lty = 2)
})

## ---- fig09: similar dyes amplify noise --------------------------------------

fig("fig09-similar-dyes.png", 1700, 1600, mfrow = c(2, 2), {
  cells(measured,  "different dyes: measured = S × true", lim = c(-1500, 6000))
  cells(measured2, "similar dyes: measured = S2 × true", lim = c(-1500, 6000))
  cells(comp,  "compensated: det(S) = 0.995", xlab = "FITC", ylab = "PE", lim = c(-1500, 6000))
  cells(comp2, "compensated: det(S2) = 0.19", xlab = "FITC", ylab = "PE", lim = c(-1500, 6000))
})

## ---- fig03: a real FCS file --------------------------------------------------

# Minimal FCS 2.0/3.0 reader for list-mode integer data: the header gives byte
# offsets of the TEXT (keywords) and DATA segments; $PnE says whether channel n
# is stored on a log scale (value = f2 * 10^(f1 * channel / range)).
read_fcs <- function(file) {
  raw <- readBin(file, "raw", file.size(file))
  off <- as.integer(substring(rawToChar(raw[1:58]), c(11, 19, 27, 35), c(18, 26, 34, 42)))
  txt <- iconv(rawToChar(raw[(off[1] + 1):(off[2] + 1)]), "latin1", "UTF-8")
  parts <- strsplit(substring(txt, 2), substr(txt, 1, 1), fixed = TRUE)[[1]]
  kw <- setNames(parts[c(FALSE, TRUE)], parts[c(TRUE, FALSE)])
  npar <- as.integer(kw[["$PAR"]])
  stopifnot(kw[["$DATATYPE"]] == "I", all(kw[paste0("$P", 1:npar, "B")] == "16"))
  x <- readBin(raw[(off[3] + 1):(off[4] + 1)], "integer", n = npar * as.integer(kw[["$TOT"]]),
               size = 2, signed = FALSE, endian = if (kw[["$BYTEORD"]] == "1,2") "little" else "big")
  m <- matrix(as.numeric(x), ncol = npar, byrow = TRUE,
              dimnames = list(NULL, kw[paste0("$P", 1:npar, "N")]))
  for (j in 1:npar) {
    e <- as.numeric(strsplit(kw[[paste0("$P", j, "E")]], ",")[[1]])
    if (e[1] > 0) m[, j] <- e[2] * 10^(e[1] * m[, j] / as.numeric(kw[[paste0("$P", j, "R")]]))
  }
  m
}

fcs <- read_fcs("flowcore-0877408774.B08.fcs")
cat("real FCS:", nrow(fcs), "cells x", ncol(fcs), "channels\n")
print(round(head(fcs[, c("FSC-H", "SSC-H", "FL1-H", "FL2-H")], 4), 1))

fig("fig03-real-data.png", 1700, 850, mfrow = c(1, 2), {
  dens <- function(x, y) adjustcolor("#1b2a3a", 0.25)
  plot(fcs[, "FSC-H"], fcs[, "SSC-H"], pch = 16, cex = 0.3, col = dens(),
       xlab = "forward scatter (FSC): size", ylab = "side scatter (SSC): granularity",
       main = "light scattered by each cell", font.main = 1, cex.main = 1.1)
  plot(fcs[, "FL1-H"], fcs[, "FL2-H"], pch = 16, cex = 0.3, col = dens(), log = "xy",
       xlab = "FL1 detector (green, e.g. FITC)", ylab = "FL2 detector (orange, e.g. PE)",
       main = "fluorescence, log axes", font.main = 1, cex.main = 1.1)
})

cat("done\n")
