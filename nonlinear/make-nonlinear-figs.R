# Figures for the nonlinear/ unit ("Beyond linear models").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd nonlinear && Rscript make-nonlinear-figs.R
#
# Writes fig01-04, fig06 and fig07 (fig05, the network diagram, is a separate,
# hand-written SVG file) and prints the numbers quoted on the slides, in the
# exercise and in the quiz. Base R only. Colours follow the vae/ figures.

ink   <- "#1b2a3a"   # text and lines
cBlue <- "#2a6f97"
cRed  <- "#bc4749"
cGrn  <- "#6a994e"
cOrg  <- "#c4621a"
cGrey <- "#8d99ae"

fig <- function(file, w, h, expr) {
  svg(file, width = w, height = h, family = "Helvetica")
  par(mar = c(4.2, 4.6, 1.6, 1), las = 1, mgp = c(2.8, 0.7, 0), col.axis = ink, col.lab = ink, fg = ink,
      cex.axis = 1.1, cex.lab = 1.2)
  expr
  invisible(dev.off())
}

## ---- fig01: a curve that is still a linear model ------------------------------
## Growth rate of a bacterium against temperature: y ~ temp + temp^2 with lm().
set.seed(1)
temp <- seq(22, 40, by = 2)
g <- round(1.2 - 0.006 * (temp - 33)^2 + rnorm(length(temp), 0, 0.05), 2)
fit1 <- lm(g ~ temp + I(temp^2))
cat("fig01: growth rates:", g, "\n")
cat("fig01: coefficients:", round(coef(fit1), 4), "; optimum at",
    round(-coef(fit1)[2] / (2 * coef(fit1)[3]), 1), "degrees\n")
fig("fig01-poly-fit.svg", 6.4, 4.6, {
  plot(temp, g, pch = 21, bg = ink, col = "white", cex = 1.8, xlim = c(21, 41), ylim = c(0.3, 1.35),
       xlab = "temperature (°C)", ylab = "growth rate (doublings / h)")
  tt <- seq(21, 41, length.out = 200)
  lines(tt, predict(fit1, data.frame(temp = tt)), col = cBlue, lwd = 3)
  text(26.5, 1.27, "lm(growth ~ temp + I(temp^2))", col = cBlue, cex = 1.1, font = 2)
})

## ---- the dose-response data (used on the slides and in the exercise) -----------
dose <- rep(c(0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30), each = 2)
v    <- c(96, 98, 99, 94, 94, 93, 79, 83, 43, 53, 21, 19, 9, 13, 10, 8)
hill <- function(d, bottom, top, ec50, h) bottom + (top - bottom) / (1 + (d / ec50)^h)
start <- list(bottom = 0, top = 100, ec50 = 1, h = 1)
fit2 <- nls(v ~ bottom + (top - bottom) / (1 + (dose / ec50)^h), start = start)
cf <- coef(fit2)
cat("fig02: nls estimates:", round(cf, 2), "; SSE =", round(sum(resid(fit2)^2), 1),
    "; iterations =", fit2$convInfo$finIter, "\n")
dd <- 10^seq(-2.3, 1.7, length.out = 300)

fig("fig02-dose-response.svg", 6.6, 4.6, {
  plot(dose, v, log = "x", pch = 21, bg = ink, col = "white", cex = 1.6, ylim = c(0, 110), xaxt = "n",
       xlab = "drug concentration (µM, log scale)", ylab = "viable cells (%)")
  axis(1, at = c(0.01, 0.1, 1, 10), labels = c("0.01", "0.1", "1", "10"))
  abline(h = cf[c("bottom", "top")], col = cGrey, lty = 2)
  segments(cf["ec50"], -5, cf["ec50"], hill(cf["ec50"], cf[1], cf[2], cf[3], cf[4]), col = cRed, lty = 2, lwd = 2)
  lines(dd, hill(dd, cf[1], cf[2], cf[3], cf[4]), col = cBlue, lwd = 3)
  text(30, cf["top"] + 5, "top", col = cGrey, adj = 1, cex = 1.1)
  text(0.012, cf["bottom"] + 6, "bottom", col = cGrey, adj = 0, cex = 1.1)
  text(cf["ec50"] * 1.15, 6, "EC50", col = cRed, adj = 0, cex = 1.1, font = 2)
  text(2.2, 72, "slope h:\nhow steep", col = cBlue, adj = 0, cex = 1.1)
})

## ---- fig03: nls improves the curve step by step ---------------------------------
## Started from a poor guess (EC50 = 0.1) so that the steps are visible.
## From EC50 = 10 instead, nls stops with an error (printed below).
poor <- list(bottom = 0, top = 100, ec50 = 0.1, h = 1)
ks <- c(0, 1, 3, 4, 8)
steps <- lapply(ks, function(k) {
  if (k == 0) return(unlist(poor))
  coef(suppressWarnings(nls(v ~ bottom + (top - bottom) / (1 + (dose / ec50)^h), start = poor,
                            control = nls.control(maxiter = k, warnOnly = TRUE))))
})
sse <- sapply(steps, function(p) sum((v - hill(dose, p[1], p[2], p[3], p[4]))^2))
cat("fig03: SSE after", ks, "steps:", round(sse, 1), "\n")
cat("fig03: EC50 after", ks, "steps:", round(sapply(steps, `[`, 3), 2), "\n")
r10 <- try(nls(v ~ bottom + (top - bottom) / (1 + (dose / ec50)^h),
               start = list(bottom = 0, top = 100, ec50 = 10, h = 1)), silent = TRUE)
cat("fig03: start EC50 = 10 gives:", conditionMessage(attr(r10, "condition")), "\n")
fig("fig03-nls-steps.svg", 6.6, 4.6, {
  plot(dose, v, log = "x", pch = 21, bg = ink, col = "white", cex = 1.6, ylim = c(0, 110), xaxt = "n",
       xlab = "drug concentration (µM, log scale)", ylab = "viable cells (%)")
  axis(1, at = c(0.01, 0.1, 1, 10), labels = c("0.01", "0.1", "1", "10"))
  cols <- c(cGrey, cRed, cOrg, cGrn, cBlue)
  ltys <- c(2, 1, 1, 1, 1)
  for (k in seq_along(ks)) {
    p <- steps[[k]]
    lines(dd, hill(dd, p[1], p[2], p[3], p[4]), col = cols[k], lwd = 2.5, lty = ltys[k])
  }
  legend("bottomleft", sprintf("%s: SSE %.0f", c("start", paste("step", ks[-1])), sse),
         col = cols, lty = ltys, lwd = 2.5, bty = "n", text.col = ink, cex = 1.0)
})

## ---- fig04: local minima when fitting the period of a rhythm --------------------
## Clock reporter measured every 2 h for 48 h. For a FIXED period P the model
## m + a cos(2 pi t / P) + b sin(2 pi t / P) is linear (a Fourier basis, lm);
## P itself sits inside the cos and sin, so it is a nonlinear parameter.
t <- seq(0, 46, by = 2)
y <- c(4.3, 6.6, 8.9, 7.1, 7.5, 6.6, 5.6, 3.3, 4.0, 1.9, 2.7, 4.3,
       4.7, 5.7, 9.0, 6.2, 8.3, 6.5, 5.8, 3.8, 4.1, 1.0, 3.7, 5.1)
## (simulated once: 5 + 3 cos(2 pi (t - 6) / 24) + noise sd 0.8, set.seed(2), rounded)
PP <- seq(5, 48, by = 0.05)
sseP <- sapply(PP, function(p) sum(resid(lm(y ~ cos(2 * pi * t / p) + sin(2 * pi * t / p)))^2))
mins <- which(diff(sign(diff(sseP))) == 2) + 1
cat("fig04: local minima of SSE over the period:\n"); print(cbind(P = PP[mins], SSE = round(sseP[mins], 1)))
fitP <- function(p0) nls(y ~ m + a * cos(2 * pi * t / P) + b * sin(2 * pi * t / P),
                         start = list(m = 5, a = 1, b = 1, P = p0))
good <- fitP(20); bad <- fitP(12)
cat("fig04: start P = 20 ->", round(coef(good)["P"], 2), "h, SSE", round(sum(resid(good)^2), 1),
    "; start P = 12 ->", round(coef(bad)["P"], 2), "h, SSE", round(sum(resid(bad)^2), 1), "\n")
fig("fig04-local-minima.svg", 11, 4.2, {
  layout(matrix(1:2, 1), widths = c(1, 1))
  plot(t, y, pch = 21, bg = ink, col = "white", cex = 1.5, xlab = "time (h)", ylab = "reporter signal",
       ylim = c(0, 10.5), xaxt = "n")
  axis(1, at = seq(0, 48, 12))
  ts <- seq(0, 46, length.out = 400)
  lines(ts, predict(good, data.frame(t = ts)), col = cBlue, lwd = 3)
  lines(ts, predict(bad, data.frame(t = ts)), col = cRed, lwd = 2.5, lty = 2)
  legend("bottomleft", c(sprintf("start 20 h → period %.1f h", coef(good)["P"]),
                         sprintf("start 12 h → period %.1f h", coef(bad)["P"])),
         col = c(cBlue, cRed), lwd = c(3, 2.5), lty = c(1, 2), bty = "n", text.col = ink, cex = 1.0)
  plot(PP, sseP, type = "l", lwd = 2.5, col = ink, xlab = "period P (h)", ylab = "sum of squared errors",
       ylim = c(0, 125))
  points(coef(good)["P"], sum(resid(good)^2), pch = 21, bg = cBlue, col = "white", cex = 2)
  points(coef(bad)["P"], sum(resid(bad)^2), pch = 21, bg = cRed, col = "white", cex = 2)
  arrows(20, 112, 23.2, 30, col = cBlue, lwd = 2, length = 0.1)
  text(20, 118, "start 20", col = cBlue, cex = 1.0)
  arrows(12, 115, 10.9, 101, col = cRed, lwd = 2, length = 0.1)
  text(12, 121, "start 12", col = cRed, cex = 1.0)
  text(26, 14, "best fit", col = cBlue, adj = 0, cex = 1.05, font = 2)
  text(14, 82, "stuck in a\nlocal minimum", col = cRed, cex = 1.0)
})

## ---- fig06: hinges from a ReLU layer add up to a curve --------------------------
## One input (log10 dose), three hidden ReLU units with fixed hinges, one output.
## With the hidden layer fixed, the output layer is an ordinary lm() on the hinges.
relu <- function(z) pmax(0, z)
u <- log10(dose)
knots <- c(-1, -0.25, 0.5)
H <- sapply(knots, function(k) relu(u - k))
fit6 <- lm(v ~ H)
cat("fig06: output weights (d, then one per hinge):", round(coef(fit6), 1),
    "; SSE =", round(sum(resid(fit6)^2), 1), "\n")
uu <- seq(-2.2, 1.6, length.out = 300)
HH <- sapply(knots, function(k) relu(uu - k))
fig("fig06-relu-hinges.svg", 11, 4.2, {
  layout(matrix(1:2, 1), widths = c(1, 1.1))
  hc <- c(cOrg, cGrn, "#7b2cbf")
  matplot(uu, HH, type = "l", lty = 1, lwd = 3, col = hc, xlab = "input x = log10(dose)",
          ylab = "hidden unit = ReLU(x − k)", ylim = c(0, 2.6))
  legend("topleft", paste0("hinge at k = ", knots), col = hc, lwd = 3, bty = "n", text.col = ink, cex = 1.05)
  plot(u, v, pch = 21, bg = ink, col = "white", cex = 1.5, ylim = c(0, 110),
       xlab = "input x = log10(dose)", ylab = "viable cells (%)")
  lines(uu, cbind(1, HH) %*% coef(fit6), col = cRed, lwd = 3)
  lines(uu, hill(10^uu, cf[1], cf[2], cf[3], cf[4]), col = cBlue, lwd = 2, lty = 2)
  legend("bottomleft", c("network: d + weighted sum of 3 hinges", "Hill curve (nls)"),
         col = c(cRed, cBlue), lwd = c(3, 2), lty = c(1, 2), bty = "n", text.col = ink, cex = 1.0)
})

## ---- fig07: a ring needs a curved coordinate ------------------------------------
## Cells cycling through G1 -> S -> G2/M: two marker genes trace out a ring.
set.seed(8)
n <- 160
ang <- runif(n, 0, 2 * pi)
G <- cbind(2.0 * cos(ang), 1.3 * sin(ang)) + matrix(rnorm(2 * n, 0, 0.12), n)
pc <- prcomp(G)
score <- pc$x[, 1] * sign(pc$rotation[1, 1])
theta <- atan2(G[, 2] / 1.3, G[, 1] / 2.0) %% (2 * pi)
cat("fig07: PC1 =", round(pc$rotation[, 1] * sign(pc$rotation[1, 1]), 2),
    "; share of variance on PC1 =", round(summary(pc)$importance[2, 1], 2), "\n")
colOf <- function(a) {
  # a cyclic palette: hue goes once round the colour wheel as the angle goes round the ring
  hcl(h = (a / (2 * pi)) * 360, c = 65, l = 55)
}
fig("fig07-ring-pca.svg", 11, 4.3, {
  layout(matrix(c(1, 1, 2, 3), 2), widths = c(1, 1.25))
  par(mar = c(4.2, 4.6, 1.2, 1))
  plot(G, pch = 21, bg = colOf(ang), col = "white", cex = 1.3, asp = 1, xlim = c(-2.6, 2.6),
       xlab = "gene A (centred)", ylab = "gene B (centred)")
  abline(h = 0, col = cBlue, lwd = 2.5)
  text(2.55, 0.18, "PC1", col = cBlue, font = 2, adj = 1, cex = 1.1)
  i1 <- which.min(abs(ang - pi / 3)); i2 <- which.min(abs(ang - 5 * pi / 3))
  for (i in c(i1, i2)) segments(G[i, 1], G[i, 2], G[i, 1], 0, col = ink, lty = 2, lwd = 1.5)
  points(G[c(i1, i2), , drop = FALSE], pch = 21, bg = colOf(ang[c(i1, i2)]), col = ink, cex = 2.2, lwd = 2)
  par(mar = c(3.4, 1.5, 2.2, 1))
  plot(score, jitter(rep(0, n), amount = 0.3), pch = 21, bg = colOf(ang), col = "white", cex = 1.3,
       ylim = c(-0.6, 0.6), yaxt = "n", xlab = "", ylab = "", bty = "n")
  mtext("flat: one number = PC1 score (different phases overlap)", side = 3, line = 0.4, cex = 0.95, col = ink, font = 2)
  plot(theta * 180 / pi, jitter(rep(0, n), amount = 0.3), pch = 21, bg = colOf(ang), col = "white", cex = 1.3,
       ylim = c(-0.6, 0.6), yaxt = "n", xaxt = "n", xlab = "", ylab = "", bty = "n", xlim = c(0, 360))
  axis(1, at = seq(0, 360, 90), labels = paste0(seq(0, 360, 90), "°"))
  mtext("curved: one number = angle round the ring (phases in order)", side = 3, line = 0.4, cex = 0.95, col = ink, font = 2)
})
