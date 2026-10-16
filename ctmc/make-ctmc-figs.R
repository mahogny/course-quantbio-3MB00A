# Figures for the ctmc/ unit ("Continuous-time Markov chains", extra material).
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd ctmc && Rscript make-ctmc-figs.R
#
# Writes figNN-*.svg (the hand-drawn diagrams fig03, fig05, fig06, fig07 are
# separate, hand-written SVG files) and prints the numbers quoted on the slides.
# Base R only. Colours follow the markov/ figures.

set.seed(1)

ink  <- "#1b2a3a"   # text and lines
cON  <- "#2a6f97"   # state ON  (blue, as R in markov/)
cOFF <- "#bc4749"   # state OFF (red)
cALT <- "#6a994e"   # a third colour (green)

fig <- function(file, w, h, expr) {
  svg(file, width = w, height = h, family = "Helvetica")
  par(mar = c(4.2, 4.6, 1.6, 1), las = 1, mgp = c(2.8, 0.7, 0), col.axis = ink, col.lab = ink, fg = ink,
      cex.axis = 1.1, cex.lab = 1.2)
  expr
  invisible(dev.off())
}

## ---- the lecture chain: promoter ON <-> OFF ---------------------------------
a <- 0.5    # rate ON -> OFF (per min)
b <- 0.25   # rate OFF -> ON (per min)
Q <- matrix(c(-a, a,
               b, -b), 2, byrow = TRUE, dimnames = list(c("ON", "OFF"), c("ON", "OFF")))
cat("Q =\n"); print(Q)
cat(sprintf("mean time ON = 1/a = %.2f min, mean time OFF = 1/b = %.2f min\n", 1 / a, 1 / b))
cat(sprintf("pi = (b, a)/(a+b) = (%.4f, %.4f); relaxation rate a+b = %.2f /min\n",
            b / (a + b), a / (a + b), a + b))

# Gillespie simulation of one 2-state chain: returns jump times and states
gillespie2 <- function(a, b, tmax, start = "OFF") {
  t <- 0; s <- start
  times <- 0; states <- s
  while (t < tmax) {
    rate <- if (s == "ON") a else b
    t <- t + rexp(1, rate)
    s <- if (s == "ON") "OFF" else "ON"
    times <- c(times, t); states <- c(states, s)
  }
  data.frame(time = times, state = states)
}

## ---- fig02: one promoter's ON/OFF trace ---------------------------------------
set.seed(3)
tr <- gillespie2(a, b, 40)
fig("fig02-telegraph-trace.svg", 7.5, 2.6, {
  par(mar = c(4.2, 4.6, 0.8, 1))
  plot(NA, xlim = c(0, 40), ylim = c(-0.3, 1.3), xaxs = "i", yaxt = "n", bty = "n",
       xlab = "time (min)", ylab = "")
  axis(2, at = c(0, 1), labels = c("OFF", "ON"), tick = FALSE, font = 2, cex.axis = 1.2)
  for (k in seq_len(nrow(tr) - 1)) {
    x0 <- tr$time[k]; x1 <- min(tr$time[k + 1], 40)
    on <- tr$state[k] == "ON"
    rect(x0, if (on) 0.85 else -0.15, x1, if (on) 1.15 else 0.15,
         col = if (on) cON else cOFF, border = NA)
    if (x1 - x0 > 2.2) text((x0 + x1) / 2, if (on) 1.3 else 0.3, sprintf("%.1f", x1 - x0),
                            col = ink, cex = 1.1)
  }
  s <- stepfun(tr$time[-1], as.numeric(tr$state == "ON"))
  plot(s, add = TRUE, do.points = FALSE, verticals = TRUE, col = ink, lwd = 1.2, xlim = c(0, 40))
})
d <- diff(tr$time); st <- tr$state[-nrow(tr)]
cat(sprintf("fig02: %d jumps in 40 min; ON spells mean %.2f, OFF spells mean %.2f (incl. last, cut)\n",
            nrow(tr) - 1, mean(d[st == "ON"]), mean(d[st == "OFF"])))

## ---- fig04: waiting times in ON are exponential ---------------------------------
set.seed(4)
w <- rexp(2000, rate = a)
cat(sprintf("fig04: 2000 ON spells: mean %.3f (1/a = %.1f), P(T > 4) sim %.3f, exact e^-2 = %.3f\n",
            mean(w), 1 / a, mean(w > 4), exp(-a * 4)))
fig("fig04-waiting-times.svg", 7, 4, {
  hist(w, breaks = seq(0, ceiling(max(w)) + 1, by = 0.5), freq = FALSE, col = "#eaf1f7", border = cON,
       main = "", xlab = "time spent in ON before leaving (min)", ylab = "density", xlim = c(0, 12))
  curve(a * exp(-a * x), from = 0, to = 12, add = TRUE, lwd = 3, col = cOFF)
  abline(v = 1 / a, lty = 2, lwd = 2, col = ink)
  text(1 / a + 0.2, 0.43, "mean = 1/a = 2 min", adj = 0, col = ink, cex = 1.1)
  legend("topright", inset = c(0, 0.1), c("2000 simulated ON spells", "a·exp(−a·t),  a = 0.5 /min"),
         fill = c("#eaf1f7", NA), border = c(cON, NA), lwd = c(NA, 3), col = c(NA, cOFF), bty = "n", cex = 1.0)
})

## ---- fig08: relaxation to equilibrium -------------------------------------------
xon <- function(t, x0) b / (a + b) + (x0 - b / (a + b)) * exp(-(a + b) * t)
# 200 walkers, all start OFF: fraction ON on a grid of times
set.seed(8)
grid <- seq(0, 10, by = 0.05)
frac <- numeric(length(grid))
for (w_ in 1:200) {
  tr_ <- gillespie2(a, b, 10, start = "OFF")
  idx <- findInterval(grid, tr_$time)
  frac <- frac + (tr_$state[idx] == "ON") / 200
}
fig("fig08-relaxation.svg", 8, 4, {
  plot(grid, frac, type = "s", col = cON, lwd = 1.5, ylim = c(0, 1), xlab = "time (min)",
       ylab = "fraction ON", bty = "l")
  curve(xon(x, 0), 0, 10, add = TRUE, lwd = 4, col = adjustcolor(cON, 0.45))
  curve(xon(x, 1), 0, 10, add = TRUE, lwd = 4, col = adjustcolor(cOFF, 0.45))
  abline(h = b / (a + b), lty = 2, lwd = 2, col = ink)
  text(10, b / (a + b) - 0.07, expression(pi[ON] == 1/3), adj = 1, col = ink, cex = 1.2)
  legend("topright", c("exact, start all ON", "exact, start all OFF", "200 walkers, start all OFF"),
         col = c(adjustcolor(cOFF, 0.45), adjustcolor(cON, 0.45), cON), lwd = c(4, 4, 1.5), bty = "n")
})
cat(sprintf("fig08: distance to pi shrinks by e^-(a+b)t: half-way after ln2/(a+b) = %.2f min\n",
            log(2) / (a + b)))

## ---- fig09: small time steps, P = I + Q dt ------------------------------------------
fig("fig09-small-dt.svg", 8, 4, {
  curve(xon(x, 0), 0, 10, lwd = 3, col = ink, ylim = c(0, 0.6), xlab = "time (min)",
        ylab = "fraction ON (start all OFF)", bty = "l")
  pch <- c(16, 1); cols <- c(cOFF, cON); k <- 0
  for (dt in c(1, 0.25)) {
    k <- k + 1
    P <- diag(2) + Q * dt
    x <- c(0, 1); tt <- 0; xs <- x[1]
    while (tt < 10 - 1e-9) { x <- x %*% P; tt <- tt + dt; xs <- c(xs, x[1]) }
    points(seq(0, 10, by = dt), xs, pch = pch[k], col = cols[k], cex = 1.1, lwd = 1.5)
    cat(sprintf("fig09: dt = %.2f: P = [%.4f %.4f; %.4f %.4f], x_ON at t=2: %.4f (exact %.4f)\n",
                dt, P[1, 1], P[1, 2], P[2, 1], P[2, 2], xs[round(2 / dt) + 1], xon(2, 0)))
  }
  legend("bottomright", c("exact x(t)", "steps of Δt = 1 min", "steps of Δt = 0.25 min"),
         lwd = c(3, NA, NA), pch = c(NA, 16, 1), col = c(ink, cOFF, cON), bty = "n")
})

## ---- fig10: transcriptional bursting -----------------------------------------------
# Promoter switches OFF -> ON at kon, ON -> OFF at koff; while ON, mRNA is made at
# rate s; each mRNA is degraded at rate g. Gillespie over four possible events.
kon <- 0.05; koff <- 0.5; s <- 5; g <- 0.1
burst <- function(tmax, record = TRUE) {
  t <- 0; on <- FALSE; m <- 0
  out <- if (record) list(t = 0, on = on, m = m) else NULL
  while (TRUE) {
    r <- c(if (on) koff else kon, if (on) s else 0, g * m)
    tot <- sum(r)
    t <- t + rexp(1, tot)
    if (t > tmax) break
    e <- sample(3, 1, prob = r)
    if (e == 1) on <- !on else if (e == 2) m <- m + 1 else m <- m - 1
    if (record) { out$t <- c(out$t, t); out$on <- c(out$on, on); out$m <- c(out$m, m) }
  }
  if (record) as.data.frame(out) else m
}
set.seed(10)
one <- burst(300)
cells <- replicate(2000, burst(150, record = FALSE))
mu <- s / g * kon / (kon + koff)
cat(sprintf("fig10: theory mean = %.2f; 2000 cells: mean %.2f, var %.2f, var/mean %.1f, zeros %.2f (Poisson zeros %.2f)\n",
            mu, mean(cells), var(cells), var(cells) / mean(cells), mean(cells == 0), dpois(0, mean(cells))))
fig("fig10-bursting.svg", 9, 3.6, {
  layout(matrix(c(1, 2), 1), widths = c(1.6, 1))
  par(mar = c(4.2, 4.6, 1.8, 1), cex = 1)
  plot(one$t, one$m, type = "s", col = ink, lwd = 1.5, xlab = "time (min)", ylab = "mRNA in one cell",
       bty = "l", ylim = c(-4, max(one$m) + 1), yaxt = "n")
  axis(2, at = pretty(c(0, max(one$m))))
  on_k <- which(one$on)
  segs <- rle(one$on)
  ends <- cumsum(segs$lengths); starts <- c(1, head(ends, -1) + 1)
  for (k in which(segs$values)) {
    t0 <- one$t[starts[k]]; t1 <- if (ends[k] < nrow(one)) one$t[ends[k] + 1] else 300
    rect(t0, -4, t1, -1.5, col = cON, border = NA)
  }
  text(300, -2.75, "promoter ON", adj = c(1, 0.5), col = cON, cex = 0.95, xpd = TRUE)
  mtext("bursts: mRNA is made only while ON", side = 3, line = 0.2, adj = 0, col = ink)
  tb <- table(factor(cells, levels = 0:max(cells))) / length(cells)
  plot(as.numeric(names(tb)), as.numeric(tb), type = "h", lwd = 3, col = cOFF, bty = "l",
       xlab = "mRNA per cell", ylab = "fraction of cells", xlim = c(0, 40))
  points(0:40, dpois(0:40, mean(cells)), type = "b", pch = 1, col = cON, lwd = 1.5)
  legend("topright", c("2000 cells", "Poisson, same mean"), col = c(cOFF, cON), lwd = c(3, 1.5),
         pch = c(NA, 1), bty = "n")
  mtext("wider than Poisson", side = 3, line = 0.2, adj = 0, col = ink)
})
