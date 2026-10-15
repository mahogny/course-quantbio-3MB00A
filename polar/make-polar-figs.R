# Figures for the polar/ unit ("Polar coordinates: measuring a ring").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd polar && Rscript make-polar-figs.R
#
# Writes plate.jpg (the greyscale image students load) and figNN-*.png.
# The colour original is downloaded once to plate-original.jpg, which is
# .gitignored -- only the greyscale copy is committed.
#
# Image: antibiotic disk diffusion (Kirby-Bauer) test on Mueller-Hinton agar,
# CDC / Gilda L. Jones, 1972, Public Health Image Library (PHIL #10785),
# public domain. https://phil.cdc.gov/Details.aspx?pid=10785

credit <- "Image: CDC / Gilda L. Jones, PHIL #10785 (public domain)"

## ---- the image ------------------------------------------------------------

orig_file <- "plate-original.jpg"
if (!file.exists(orig_file)) {
  download.file("https://wwwn.cdc.gov/phil/PHIL_Images/10785/10785_lores.jpg",
                orig_file, mode = "wb")
}
rgb3 <- jpeg::readJPEG(orig_file)[13:612, 47:646, ]   # 600 x 600 crop around the plate

# The blue channel separates the pale zones from the tan bacterial lawn best.
# Stretch it so the lawn is dark grey and the clear zones are near white.
grey <- pmin(pmax((rgb3[, , 3] - 0.2) / (0.68 - 0.2), 0), 1)
jpeg::writeJPEG(grey, "plate.jpg", quality = 0.92)

## ---- the student setup (same code as on the slides / in the exercise) ----

img <- jpeg::readJPEG("plate.jpg")                # 600 x 600 grey levels, 0..1
img <- t(img[nrow(img):1, ])                      # flip so up is up; now img[x, y]

# Disk centres (pixels), found once from the dark 6 mm paper disks.
disks <- data.frame(x = c(218, 386, 111, 478, 353, 226, 506, 101, 322, 436, 148, 298),
                    y = c(508, 511, 403, 413, 356, 306, 275, 247, 220, 147, 113,  82))

# Check the table against the dark disks: centroid of dark pixels near each centre.
for (i in seq_len(nrow(disks))) {
  w <- img[disks$x[i] + (-20:20), disks$y[i] + (-20:20)]
  k <- which(w < 0.2, arr.ind = TRUE)
  off <- colMeans(k) - 21
  if (any(abs(off) > 1.5)) warning(sprintf("disk %d centre is off by (%.1f, %.1f)", i, off[1], off[2]))
}
px_per_mm <- 26.8 / 6          # a paper disk is 6 mm and about 26.8 px across

# Polar coordinates of every pixel around a centre (x0, y0).
xy <- t(expand.grid(1:nrow(img), 1:ncol(img)))    # 2 x N, same order as as.vector(img)
to_polar <- function(x0, y0) {
  dx <- xy[1, ] - x0
  dy <- xy[2, ] - y0
  list(r = sqrt(dx^2 + dy^2), theta = atan2(dy, dx))
}

# Unwrap: for each (r, theta) on a grid, look up the nearest pixel.
unwrap <- function(x0, y0, rmax = 80) {
  r     <- 0:rmax
  theta <- (0:359) * pi / 180
  x <- x0 + outer(r, cos(theta))
  y <- y0 + outer(r, sin(theta))
  matrix(img[cbind(round(as.vector(x)), round(as.vector(y)))], nrow = length(r))   # rows = r, cols = theta
}

threshold <- 0.55             # halfway between the lawn (~0.3) and a clear zone (~0.85)
edge_of <- function(v, rmin = 16) {             # first radius past the disk below threshold
  min(which(0:(length(v) - 1) >= rmin & v < threshold)) - 1
}

## ---- numbers used in the text ---------------------------------------------

p5   <- to_polar(disks$x[5], disks$y[5])
near <- p5$r <= 80
prof <- tapply(as.vector(img)[near], round(p5$r[near]), mean)   # radial profile, r = 0..80
e5   <- edge_of(prof)
cat(sprintf("disk 5: edge at r = %d px = %.1f mm; zone diameter %.0f mm\n",
            e5, e5 / px_per_mm, 2 * e5 / px_per_mm))

u5 <- unwrap(disks$x[5], disks$y[5])
cat(sprintf("disk 5: rowMeans(unwrap) edge = %d px (same idea, different sampling)\n",
            edge_of(rowMeans(u5))))

all_edges <- sapply(seq_len(nrow(disks)), function(i)
  edge_of(rowMeans(unwrap(disks$x[i], disks$y[i]))))
diam_mm <- 2 * all_edges / px_per_mm
print(data.frame(disk = seq_len(nrow(disks)), edge_px = all_edges, diameter_mm = round(diam_mm)))

u4 <- unwrap(disks$x[4], disks$y[4], rmax = 100)
r_theta4 <- apply(u4, 2, edge_of)
cat(sprintf("disk 4: r(theta) from %d to %d px (%.0f to %.0f mm diameter-equivalent); max at %d deg, min at %d deg\n",
            min(r_theta4), max(r_theta4), 2 * min(r_theta4) / px_per_mm, 2 * max(r_theta4) / px_per_mm,
            which.max(r_theta4) - 1, which.min(r_theta4) - 1))

## ---- plotting helpers -----------------------------------------------------

fig <- function(file, w, h, expr, mfrow = c(1, 1), credit_line = TRUE) {
  png(file, width = w, height = h, res = 200)
  par(mfrow = mfrow, mar = c(4, 4, 2.2, 1), oma = c(1.2, 0, 0, 0), las = 1)
  expr
  if (credit_line) mtext(credit, side = 1, outer = TRUE, line = 0.2, cex = 0.7, col = "grey40", adj = 1)
  dev.off()
}

# Show img (or a window of it) as a picture in x, y pixel coordinates.
show_img <- function(xlim = c(1, nrow(img)), ylim = c(1, ncol(img)), main = "", m = img, ...) {
  xs <- xlim[1]:xlim[2]; ys <- ylim[1]:ylim[2]
  plot(NA, xlim = xlim + c(-0.5, 0.5), ylim = ylim + c(-0.5, 0.5), asp = 1,
       xlab = "x (pixels)", ylab = "y (pixels)", main = main, font.main = 1, cex.main = 1.1, ...)
  sub <- m[xs, ys]
  rasterImage(as.raster(t(sub[, ncol(sub):1])), xlim[1] - 0.5, ylim[1] - 0.5,
              xlim[2] + 0.5, ylim[2] + 0.5, interpolate = FALSE)
}

# A text label in a white box, so it stays readable on top of the image.
lab <- function(x, y, s, col, cex = 1.2) {
  w <- strwidth(s, cex = cex) / 2 + strwidth("m", cex = cex) / 3
  h <- strheight(s, cex = cex) / 2 + strheight("M", cex = cex) / 3
  rect(x - w, y - h, x + w, y + h, col = "white", border = col)
  text(x, y, s, col = col, cex = cex)
}

## ---- fig02: the plate, disks numbered (colour) ----------------------------

fig("fig02-plate.png", 1100, 1100, {
  par(mar = c(0.3, 0.3, 0.3, 0.3))
  plot.new(); plot.window(c(0.5, 600.5), c(0.5, 600.5), asp = 1)
  rasterImage(as.raster(rgb3), 0.5, 0.5, 600.5, 600.5)
  lab_x <- disks$x + 0; lab_y <- disks$y + 24
  for (i in seq_len(nrow(disks))) {
    rect(lab_x[i] - 11, lab_y[i] - 10, lab_x[i] + 11, lab_y[i] + 10, col = "white", border = "grey30")
    text(lab_x[i], lab_y[i], i, cex = 0.9, font = 2)
  }
})

## ---- fig03: polar coordinates of one point around disk 5 ------------------

fig("fig03-polar-coords.png", 1100, 1000, {
  x0 <- disks$x[5]; y0 <- disks$y[5]
  show_img(x0 + c(-70, 70), y0 + c(-70, 70))
  th <- 35 * pi / 180; rr <- e5
  px <- x0 + rr * cos(th); py <- y0 + rr * sin(th)
  segments(x0, y0, x0 + 68, y0, col = "grey20", lty = 2, lwd = 1.5)                  # theta = 0 ray
  arrows(x0, y0, px, py, col = "red3", lwd = 3, length = 0.1)
  a <- seq(0, th, length.out = 30)
  lines(x0 + 18 * cos(a), y0 + 18 * sin(a), col = "blue3", lwd = 2.5)
  points(x0, y0, pch = 3, cex = 1.6, lwd = 2.5, col = "red3")
  points(px, py, pch = 21, bg = "yellow", cex = 1.6)
  lab(x0 + 0.55 * rr * cos(th) - 8, y0 + 0.55 * rr * sin(th) + 9, "r", "red3")
  lab(x0 + 29, y0 + 9, expression(theta), "blue3")
  lab(px + 6, py + 13, "(x, y)", "black")
  lab(x0 - 4, y0 - 13, expression((x[0] * "," ~ y[0])), "red3")
})

## ---- fig04: polar coordinates are not a matrix ----------------------------

fig("fig04-not-linear.png", 1600, 800, mfrow = c(1, 2), credit_line = FALSE, {
  rs <- c(1, 2, 3); ths <- seq(0, 330, by = 30) * pi / 180
  a  <- seq(0, 2 * pi, length.out = 200)
  # a straight vertical line x = 1.5
  ly <- seq(-2.6, 2.6, length.out = 200); lx <- rep(1.5, 200)
  plot(NA, xlim = c(-3.2, 3.2), ylim = c(-3.2, 3.2), asp = 1, xlab = "x", ylab = "y",
       main = "(x, y): circles and rays", font.main = 1, cex.main = 1.1)
  for (r in rs) lines(r * cos(a), r * sin(a), col = "steelblue", lwd = 2)
  for (t in ths) segments(0, 0, 3.2 * cos(t), 3.2 * sin(t), col = "grey60")
  lines(lx, ly, col = "red3", lwd = 3)
  points(0, 0, pch = 3, lwd = 2)
  lab(-1.6, 2.85, "straight line x = 1.5", "red3", cex = 0.85)

  plot(NA, xlim = c(0, 360), ylim = c(0, 3.2), xlab = expression(theta ~ "(degrees)"), ylab = "r",
       main = expression("(" * theta * ", r): the same picture unwrapped"), font.main = 1, cex.main = 1.1,
       xaxt = "n")
  axis(1, at = seq(0, 360, 90))
  for (r in rs) abline(h = r, col = "steelblue", lwd = 2)
  for (t in ths) abline(v = t * 180 / pi, col = "grey60")
  lt <- (atan2(ly, lx) * 180 / pi) %% 360; lr <- sqrt(lx^2 + ly^2)
  o <- order(lt); lt <- lt[o]; lr <- lr[o]
  brk <- which(diff(lt) > 100)                      # split where theta wraps around 0/360
  lines(lt[1:brk], lr[1:brk], col = "red3", lwd = 3)
  lines(lt[(brk + 1):length(lt)], lr[(brk + 1):length(lt)], col = "red3", lwd = 3)
  lab(180, 2.45, "the same line, now bent", "red3", cex = 0.85)
})

## ---- fig05: intensity of every pixel against its distance r ---------------

fig("fig05-pixels-vs-r.png", 1600, 800, mfrow = c(1, 2), {
  x0 <- disks$x[5]; y0 <- disks$y[5]
  show_img(x0 + c(-80, 80), y0 + c(-80, 80), main = "disk 5")
  a <- seq(0, 2 * pi, length.out = 200)
  for (r in c(20, 40, 60, 80)) lines(x0 + r * cos(a), y0 + r * sin(a), col = "cyan3", lty = 2)
  points(x0, y0, pch = 3, cex = 1.4, lwd = 2, col = "red3")
  plot(p5$r[near], as.vector(img)[near], pch = 16, cex = 0.25, col = rgb(0, 0, 0, 0.12),
       xlab = "r: distance from the disk centre (pixels)", ylab = "grey level",
       main = "every pixel within r = 80", font.main = 1, cex.main = 1.1, xlim = c(0, 80))
  abline(v = c(20, 40, 60, 80), col = "cyan3", lty = 2)
})

## ---- fig06: the radial profile and the zone edge --------------------------

fig("fig06-radial-profile.png", 1500, 850, {
  par(mar = c(4, 4, 3.2, 1))
  r <- as.numeric(names(prof))
  plot(r, prof, type = "n", ylim = c(0, 1), xlab = "r (pixels)", ylab = "mean grey level",
       main = "", xlim = c(0, 80))
  rect(-5, -1, 13.4, 2, col = "grey88", border = NA)
  rect(13.4, -1, e5, 2, col = "lightyellow", border = NA)
  rect(e5, -1, 90, 2, col = "wheat", border = NA)
  text(6.7, 0.95, "disk", cex = 0.95); text((13.4 + e5) / 2, 0.95, "clear zone", cex = 0.95)
  text((e5 + 80) / 2, 0.95, "bacterial lawn", cex = 0.95)
  abline(h = threshold, lty = 2, col = "grey30")
  text(78, threshold + 0.04, "threshold 0.55", adj = 1, cex = 0.85, col = "grey30")
  lines(r, prof, lwd = 2.5)
  abline(v = e5, col = "red3", lwd = 2.5)
  text(e5 + 1, 0.12, sprintf("edge: r = %d px = %.1f mm", e5, e5 / px_per_mm), adj = 0, col = "red3", cex = 0.95)
  axis(3, at = (0:8 * 2) * px_per_mm, labels = 0:8 * 2)
  mtext("r (mm)", side = 3, line = 2, cex = 0.9)
})

## ---- fig07: unwrapping disk 5 ---------------------------------------------

show_strip <- function(u, main, edge = NULL) {
  plot(NA, xlim = c(0, 360), ylim = c(0, nrow(u) - 1), xlab = expression(theta ~ "(degrees)"),
       ylab = "r (pixels)", main = main, font.main = 1, cex.main = 1.1, xaxt = "n")
  axis(1, at = seq(0, 360, 90))
  rasterImage(as.raster(u[nrow(u):1, ]), -0.5, -0.5, 359.5, nrow(u) - 0.5, interpolate = FALSE)
  if (!is.null(edge)) lines(0:359, edge, col = "red3", lwd = 2)
}

fig("fig07-unwrap.png", 1700, 800, mfrow = c(1, 2), {
  x0 <- disks$x[5]; y0 <- disks$y[5]
  show_img(x0 + c(-80, 80), y0 + c(-80, 80), main = "disk 5")
  a <- seq(0, 2 * pi, length.out = 200)
  lines(x0 + e5 * cos(a), y0 + e5 * sin(a), col = "red3", lwd = 2, lty = 2)
  for (t in c(0, 90, 180, 270) * pi / 180) segments(x0, y0, x0 + 80 * cos(t), y0 + 80 * sin(t), col = "cyan3", lwd = 1.5)
  lab(x0 + 70, y0 + 8, "0°", "cyan4", cex = 0.85)
  lab(x0 + 12, y0 + 72, "90°", "cyan4", cex = 0.85)
  points(x0, y0, pch = 3, cex = 1.4, lwd = 2, col = "red3")
  show_strip(u5, "unwrapped: the ring is a straight band")
  abline(h = e5, col = "red3", lwd = 2, lty = 2)
  abline(v = c(0, 90, 180, 270), col = "cyan3", lwd = 1.5)
})

## ---- fig08: a zone that is not round (disk 4) -----------------------------

fig("fig08-oval-zone.png", 1700, 800, mfrow = c(1, 2), {
  x0 <- disks$x[4]; y0 <- disks$y[4]
  show_img(pmin(x0 + c(-100, 100), 600), y0 + c(-100, 100), main = "disk 4")
  th <- (0:359) * pi / 180
  lines(x0 + r_theta4 * cos(th), y0 + r_theta4 * sin(th), col = "red3", lwd = 2)
  points(x0, y0, pch = 3, cex = 1.4, lwd = 2, col = "red3")
  show_strip(u4, "unwrapped: the edge r(θ) is wavy", edge = r_theta4)
})

## ---- fig09: zone diameters for the whole plate ----------------------------

fig("fig09-all-zones.png", 1500, 800, {
  par(mar = c(4, 4.5, 1, 1))
  b <- barplot(diam_mm, names.arg = seq_along(diam_mm), col = "lightyellow", border = "grey30",
               xlab = "disk", ylab = "zone diameter (mm)", ylim = c(0, max(diam_mm) * 1.15))
  text(b, diam_mm, round(diam_mm), pos = 3, cex = 0.9)
  abline(h = 6, lty = 2, col = "grey40")
  legend("topright", "dashed: the disk itself (6 mm)", bty = "n", text.col = "grey40", cex = 0.8)
})

cat("done\n")
