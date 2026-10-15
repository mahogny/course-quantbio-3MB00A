# Figures for the matrix-images/ unit ("Transforming images with matrices").
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd matrix-images && Rscript make-image-figs.R
#
# Writes msc-small.jpg (the downsampled image students load) and figNN-*.png.
# The full-size original is downloaded once to msc-original.jpg, which is
# .gitignored -- only the small copy is committed.
#
# Image: transmission electron micrograph of a mesenchymal stem cell,
# Robert M. Hunt, CC BY 3.0, via Wikimedia Commons
# https://commons.wikimedia.org/wiki/File:MSC_high_magnification.jpg

credit <- "Image: Robert M. Hunt, CC BY 3.0, via Wikimedia Commons"

## ---- the image ------------------------------------------------------------

orig_file <- "msc-original.jpg"
if (!file.exists(orig_file)) {
  download.file("https://upload.wikimedia.org/wikipedia/commons/5/52/MSC_high_magnification.jpg",
                orig_file, mode = "wb")
}
big <- jpeg::readJPEG(orig_file)          # 2400 x 1803, greyscale
if (length(dim(big)) == 3) big <- big[, , 1]

# block-average 15 x 15 pixel blocks -> 160 x 120 (less aliasing than decimation)
f  <- 15
nr <- nrow(big) %/% f
nc <- ncol(big) %/% f
big <- big[1:(nr * f), 1:(nc * f)]
small <- matrix(colMeans(matrix(aperm(array(big, c(f, nr, f, nc)), c(1, 3, 2, 4)), f * f)), nr, nc)
small <- (small - min(small)) / diff(range(small))   # stretch contrast to 0..1
jpeg::writeJPEG(small, "msc-small.jpg", quality = 0.95)

## ---- the student setup (same code as on the slides / in the exercise) ----

img <- jpeg::readJPEG("msc-small.jpg")            # greyscale matrix, values 0..1
img <- t(img[nrow(img):1, ])                      # image rows count from the top: flip so up is up
xy  <- t(expand.grid(1:nrow(img), 1:ncol(img)))   # 2 x N: one pixel per column
col <- gray(img)                                  # one grey level per pixel

rot <- function(theta) {
  matrix(c(cos(theta), -sin(theta),
           sin(theta),  cos(theta)), nrow = 2, byrow = TRUE)
}
shear <- function(k) matrix(c(1, k,
                              0, 1), nrow = 2, byrow = TRUE)

R <- rot(pi/6)                 # rotate 30 degrees
H <- shear(0.5)                # skew: x moves by half of y
S <- diag(c(1.5, 0.75))        # resize: wider and flatter

## ---- plotting helpers -----------------------------------------------------

frame0 <- cbind(c(0.5, 0.5), c(nrow(img) + 0.5, 0.5),
                c(nrow(img) + 0.5, ncol(img) + 0.5), c(0.5, ncol(img) + 0.5))

# Plot the image after applying A. Each pixel is drawn as its unit square
# mapped through A (a parallelogram), so the figure has no holes. With
# holes = TRUE each moved pixel is drawn as a small square instead, which is
# what plotting the moved points (as students do) looks like when A stretches.
pix <- function(A, half) {
  corners <- cbind(c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)) * half
  P <- A %*% xy
  C <- lapply(1:4, function(k) P + as.vector(A %*% corners[, k]))
  list(x = rbind(C[[1]][1, ], C[[2]][1, ], C[[3]][1, ], C[[4]][1, ], NA),
       y = rbind(C[[1]][2, ], C[[2]][2, ], C[[3]][2, ], C[[4]][2, ], NA))
}

show <- function(A = diag(2), lim, main = "", holes = FALSE, frame = TRUE) {
  plot(NA, xlim = lim[[1]], ylim = lim[[2]], asp = 1, xlab = "x", ylab = "y",
       main = main, las = 1, cex.main = 1.1, font.main = 1)
  abline(h = 0, v = 0, col = "grey85")
  q <- if (holes) pix(diag(2), 0.5) else pix(A, 0.5)
  if (holes) {                                   # unit squares at the moved points
    P <- A %*% xy
    q$x <- q$x - rep(xy[1, ], each = 5) + rep(P[1, ], each = 5)
    q$y <- q$y - rep(xy[2, ], each = 5) + rep(P[2, ], each = 5)
  }
  polygon(as.vector(q$x), as.vector(q$y), col = col, border = col, lwd = 0.25)
  if (abs(det(A)) < 1e-9)                         # collapsed to a line: make it visible
    points(t(A %*% xy), col = col, pch = 15, cex = 0.5)
  if (frame) polygon(t(frame0), border = "grey50", lty = 2)
  points(0, 0, pch = 3, col = "#bc4749", cex = 1.5, lwd = 2)
}

lim_of <- function(...) {
  P <- do.call(cbind, lapply(list(...), function(A) A %*% frame0))
  r <- apply(P, 1, range)
  list(r[, 1] + c(-5, 5), r[, 2] + c(-5, 5))
}

fig <- function(file, w, h, mfrow, expr) {
  png(file, width = w, height = h, res = 150)
  par(mfrow = mfrow, mar = c(3.8, 3.8, 2.4, 0.6), oma = c(1.4, 0, 0, 0),
      mgp = c(2.4, 0.5, 0), cex.axis = 0.8)
  expr
  mtext(credit, side = 1, outer = TRUE, line = 0.3, cex = 0.6, col = "grey40", adj = 1)
  dev.off()
}

mat_label <- function(A) {
  A <- round(A, 2)
  sprintf("[%g, %g ; %g, %g]", A[1, 1], A[1, 2], A[2, 1], A[2, 2])
}

## ---- fig02: an image is a matrix of points -------------------------------

fig("fig02-image-as-points.png", 1650, 700, c(1, 3), {
  show(lim = lim_of(diag(2)), main = "the image", frame = FALSE)
  rect(40.5, 80.5, 48.5, 88.5, border = "#bc4749", lwd = 2)

  # zoom on an 8 x 8 patch: each pixel is a point (x, y) with a grey level
  i <- xy[1, ] %in% 41:48 & xy[2, ] %in% 81:88
  plot(t(xy[, i]), col = col[i], pch = 15, cex = 5, asp = 1, las = 1,
       xlim = c(40.5, 48.5), ylim = c(80.5, 88.5), xlab = "x", ylab = "y",
       main = "zoom: pixels are points", cex.main = 1.1, font.main = 1)
  box(col = "#bc4749", lwd = 2)

  # the coordinate matrix
  plot.new()
  title(main = "xy: one pixel per column", cex.main = 1.1, font.main = 1)
  n <- ncol(xy)
  txt <- c(sprintf("x  %s ... %d", paste(xy[1, 1:5], collapse = "  "), xy[1, n]),
           sprintf("y  %s ... %d", paste(xy[2, 1:5], collapse = "  "), xy[2, n]))
  text(0.5, 0.80, paste(txt, collapse = "\n"), family = "mono", cex = 1.5)
  text(0.5, 0.50, sprintf("2 x %d matrix\n(%d x %d pixels)", n, nrow(img), ncol(img)),
       cex = 1.5)
  text(0.5, 0.22, "colour of column j = col[j]", cex = 1.3, col = "grey30")
})

## ---- fig03: rotation -----------------------------------------------------

L <- lim_of(diag(2), R)
fig("fig03-image-rotation.png", 1400, 760, c(1, 2), {
  show(diag(2), L, "original:  xy")
  show(R, L, "rotated 30°:  R %*% xy")
})

## ---- fig05: gallery ------------------------------------------------------

gallery <- list(
  "identity"            = diag(2),
  "scale  diag(c(2, 0.5))" = diag(c(2, 0.5)),
  "shear  [1, 0.5 ; 0, 1]" = H,
  "rotate 30°"          = R,
  "reflect  diag(c(-1, 1))" = diag(c(-1, 1)),
  "singular  [1, 1 ; 0.5, 0.5]" = matrix(c(1, 1, 0.5, 0.5), 2, byrow = TRUE)
)
L <- do.call(lim_of, unname(gallery))
fig("fig05-image-gallery.png", 1700, 1050, c(2, 3), {
  par(cex = 0.95)                        # undo mfrow's automatic shrinking of text
  for (nm in names(gallery)) show(gallery[[nm]], L, nm)
})

## ---- fig04: shear, with the columns as arrows ----------------------------

axes_arrows <- function(A, s = 60) {
  arrows(0, 0, s * A[1, 1], s * A[2, 1], col = "#bc4749", lwd = 3, length = 0.1)
  arrows(0, 0, s * A[1, 2], s * A[2, 2], col = "#2a6f97", lwd = 3, length = 0.1)
  lab <- function(v, colr, pos) {                          # label on a white box
    txt <- sprintf("(%g, %g)", v[1], v[2])
    w <- strwidth(txt, font = 2); h <- strheight(txt, font = 2)
    x <- s * v[1] + c(0, 0, 0, 0.6 * w + 6)[pos]
    y <- s * v[2] - c(0, 1.6 * h + 2, 0, 0)[pos]
    x0 <- if (pos == 4) x - 0.5 * w else x
    rect(x0 - 0.6 * w, y - 0.8 * h, x0 + 0.6 * w, y + 0.8 * h, col = "white", border = colr)
    text(x0, y, txt, col = colr, font = 2)
  }
  lab(A[, 1], "#bc4749", 1)                                 # column 1, below its tip
  lab(A[, 2], "#2a6f97", 4)                                 # column 2, right of its tip
}
L <- lim_of(diag(2), H)
fig("fig04-shear-axes.png", 1500, 760, c(1, 2), {
  show(diag(2), L, "axes: (1, 0) and (0, 1)")
  axes_arrows(diag(2))
  show(H, L, "shear: axes land on the columns (1, 0) and (0.5, 1)")
  axes_arrows(H)
})

## ---- fig06: order matters ------------------------------------------------

L <- lim_of(diag(2), H %*% R, R %*% H)
fig("fig06-image-order.png", 1650, 700, c(1, 3), {
  show(diag(2), L, "original")
  show(H %*% R, L, "rotate, then shear:  H %*% R")
  show(R %*% H, L, "shear, then rotate:  R %*% H")
})

## ---- fig07: a pipeline is one matrix -------------------------------------

M <- S %*% H %*% R
stopifnot(isTRUE(all.equal(M %*% xy, S %*% (H %*% (R %*% xy)))))
L <- lim_of(diag(2), R, H %*% R, M)
fig("fig07-image-pipeline.png", 1800, 560, c(1, 4), {
  show(diag(2), L, "original")
  show(R, L, "1. rotate:  R")
  show(H %*% R, L, "2. shear:  H R")
  show(M, L, paste("3. resize:  M = S H R =", mat_label(M)))
})

## ---- fig08: undoing a known misalignment ---------------------------------

A <- rot(-pi/9) %*% shear(0.25)          # the misalignment of the second image
L <- lim_of(diag(2), A)
fig("fig08-registration.png", 1650, 700, c(1, 3), {
  show(diag(2), L, "first image:  xy")
  show(A, L, paste("second image:  A %*% xy,  A =", mat_label(A)))
  show(solve(A) %*% A, L, "restored:  solve(A) %*% (A %*% xy)")
})

## ---- fig09: holes when scaling up ----------------------------------------

S3 <- diag(c(3, 3))
fig("fig09-gap-artefact.png", 1500, 760, c(1, 2), {
  show(S3, lim_of(S3), "scaled by 3:  diag(c(3, 3)) %*% xy", holes = TRUE)
  rect(120, 240, 180, 300, border = "#bc4749", lwd = 2)
  show(S3, list(c(120, 180), c(240, 300)), "zoom: holes between the moved pixels",
       holes = TRUE, frame = FALSE)
  box(col = "#bc4749", lwd = 2)
})

cat("done\n")
