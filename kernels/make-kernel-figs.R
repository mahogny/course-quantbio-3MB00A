# Figures for the kernels/ unit ("Image filters: 3 x 3 kernels", extra material).
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd kernels && Rscript make-kernel-figs.R
#
# Writes the R-made figures (fig02, fig05-fig09); the diagrams fig03 and fig04 are
# hand-written SVG files. Prints the numbers quoted on the slides.
# Uses the 256 x 256 micrograph of the fourier2d demo (read only) and the png package.
#
# Image: transmission electron micrograph of a mesenchymal stem cell,
# Robert M. Hunt, CC BY 3.0, via Wikimedia Commons
# https://commons.wikimedia.org/wiki/File:MSC_high_magnification.jpg

credit <- "Image: Robert M. Hunt, CC BY 3.0, via Wikimedia Commons"
ink <- "#1b2a3a"

img <- round(255 * png::readPNG("../demos/src/fourier2d/cell256.png"))   # 256 x 256, 0..255
if (length(dim(img)) == 3) img <- img[, , 1]
n <- nrow(img)

## ---- the filter: weighted sum of each 3 x 3 neighbourhood --------------------
# k is a 3 x 3 matrix of weights. border = "replicate" copies the edge pixels outward,
# "zero" pads with 0. Fast version with matrix shifts (the exercise uses loops).
filter3 <- function(m, k, border = "replicate") {
  nr <- nrow(m); nc <- ncol(m)
  if (border == "zero") {
    p <- matrix(0, nr + 2, nc + 2); p[2:(nr + 1), 2:(nc + 1)] <- m
  } else {
    p <- m[c(1, 1:nr, nr), c(1, 1:nc, nc)]
  }
  out <- matrix(0, nr, nc)
  for (dr in 0:2) for (dc in 0:2) out <- out + k[dr + 1, dc + 1] * p[1:nr + dr, 1:nc + dc]
  out
}
K <- function(...) matrix(c(...), 3, 3, byrow = TRUE)
kern <- list(
  identity  = K(0, 0, 0, 0, 1, 0, 0, 0, 0),
  box       = K(1, 1, 1, 1, 1, 1, 1, 1, 1) / 9,
  gauss     = K(1, 2, 1, 2, 4, 2, 1, 2, 1) / 16,
  sharpen   = K(0, -1, 0, -1, 5, -1, 0, -1, 0),
  laplace   = K(0, 1, 0, 1, -4, 1, 0, 1, 0),
  sobelx    = K(-1, 0, 1, -2, 0, 2, -1, 0, 1),
  sobely    = K(-1, -2, -1, 0, 0, 0, 1, 2, 1),
  emboss    = K(-2, -1, 0, -1, 1, 1, 0, 1, 2),
  shift     = K(0, 0, 0, 1, 0, 0, 0, 0, 0)
)
cat("sums of the weights:\n"); print(sapply(kern, sum))

## ---- display helpers ----------------------------------------------------------
# mode "clip": grey levels 0..255 as is; "mid": 0 = mid-grey, stretched so the largest |value| is black/white
show <- function(m, main = "", mode = "clip", cex = 1.05) {
  g <- m   # keep the matrix shape (pmin/pmax drop it)
  g[] <- if (mode == "clip") pmin(255, pmax(0, m)) / 255 else 0.5 + 0.5 * m / max(abs(m))
  plot.new()
  plot.window(c(0, ncol(m)), c(0, nrow(m)), asp = 1, xaxs = "i", yaxs = "i")
  rasterImage(as.raster(g), 0, 0, ncol(m), nrow(m), interpolate = FALSE)
  title(main = main, font.main = 1, cex.main = cex, line = 0.5, col.main = ink)
}
png_fig <- function(file, w, h, expr, cred = TRUE, res = 200) {
  png(file, width = w, height = h, res = res)
  par(mar = c(0.3, 0.3, 2.0, 0.3), oma = c(if (cred) 1.1 else 0, 0, 0, 0))
  expr
  if (cred) mtext(credit, side = 1, outer = TRUE, line = 0.1, cex = 0.6, col = "grey40", adj = 1)
  invisible(dev.off())
}

## ---- fig02: an image is a grid of numbers ------------------------------------
r0 <- 108; c0 <- 100; w <- 8          # an 8 x 8 crop at the edge of the nucleus
crop <- img[r0 + 0:(w - 1), c0 + 0:(w - 1)]
cat("\nfig02 crop (rows", r0, "-", r0 + w - 1, ", cols", c0, "-", c0 + w - 1, "):\n"); print(crop)
png_fig("fig02-image-as-numbers.png", 1700, 820, {
  layout(matrix(1:2, 1), widths = c(1, 1))
  show(img, "the micrograph: 256 × 256 pixels")
  rect(c0 - 1, n - (r0 + w - 1), c0 + w - 1, n - r0 + 1, border = "#ffd400", lwd = 3)
  plot.new(); plot.window(c(0, w), c(0, w), asp = 1, xaxs = "i", yaxs = "i")
  rasterImage(as.raster(crop / 255), 0, 0, w, w, interpolate = FALSE)
  for (i in 1:w) for (j in 1:w)
    text(j - 0.5, w - i + 0.5, crop[i, j], col = if (crop[i, j] > 120) "black" else "white", cex = 1.05)
  title(main = "zoom on the yellow box: grey levels 0–255", font.main = 1, cex.main = 1.05, line = 0.5, col.main = ink)
})

## ---- fig05: gallery of presets ----------------------------------------------
gal <- list(
  list("identity", "identity", "clip"), list("box blur (÷ 9)", "box", "clip"),
  list("Gaussian blur (÷ 16)", "gauss", "clip"), list("sharpen", "sharpen", "clip"),
  list("Laplacian (0 = grey)", "laplace", "mid"), list("Sobel x (0 = grey)", "sobelx", "mid"),
  list("Sobel y (0 = grey)", "sobely", "mid"), list("emboss", "emboss", "clip"))
png_fig("fig05-preset-gallery.png", 2000, 1080, {
  par(mfrow = c(2, 4))
  for (g in gal) {
    out <- filter3(img, kern[[g[[2]]]])
    show(out, g[[1]], g[[3]], cex = 1.2)
    cat(sprintf("fig05 %-8s output range %8.1f .. %7.1f\n", g[[2]], min(out), max(out)))
  }
})

## ---- fig06: sum of weights = 1 keeps the level, = 0 sees only changes -------
row <- c(rep(40, 12), rep(200, 12), rep(120, 12))            # a row of pixels: two steps
rowimg <- matrix(row, 3, length(row), byrow = TRUE)          # 3 identical rows
blur <- filter3(rowimg, kern$box)[2, ]
lap  <- filter3(rowimg, kern$laplace)[2, ]
sx   <- filter3(rowimg, kern$sobelx)[2, ]
cat("\nfig06 blur near step 1:", blur[11:14], "\nfig06 Laplacian near step 1:", lap[11:14],
    "\nfig06 Sobel x near steps:", sx[c(12, 13, 24, 25)], "\n")
svg("fig06-sum-of-weights.svg", width = 10, height = 4.2, family = "Helvetica")
par(mfrow = c(1, 2), mar = c(4, 4.2, 2.2, 1), las = 1, mgp = c(2.6, 0.7, 0), col.axis = ink, col.lab = ink, fg = ink,
    cex.axis = 1.05, cex.lab = 1.1)
x <- seq_along(row)
plot(x, row, type = "s", lwd = 2, col = "grey60", ylim = c(0, 230), xlab = "pixel along a row", ylab = "grey level",
     main = "sum = 1 (box blur): levels kept", font.main = 1)
lines(x, blur, type = "s", lwd = 2.5, col = "#2a6f97")
legend("topright", c("input", "blurred"), col = c("grey60", "#2a6f97"), lwd = 2.5, bty = "n")
plot(x, sx, type = "s", lwd = 2.5, col = "#bc4749", ylim = c(-400, 700), xlab = "pixel along a row", ylab = "output",
     main = "sum = 0 (Sobel x): only changes", font.main = 1)
abline(h = 0, col = "grey60", lty = 2)
text(15, 600, "dark → bright: positive", col = ink, cex = 0.95, adj = 0)
text(23, -330, "bright → dark: negative", col = ink, cex = 0.95, adj = 1)
invisible(dev.off())

## ---- fig07: borders -----------------------------------------------------------
rep_n <- function(m, k, times, border) { for (t in seq_len(times)) m <- filter3(m, k, border); m }
bz <- rep_n(img, kern$box, 10, "zero"); br <- rep_n(img, kern$box, 10, "replicate")
cat(sprintf("\nfig07 box blur x10, corner pixel: zero padding %.1f, replicate %.1f, input %d\n",
            bz[1, 1], br[1, 1], img[1, 1]))
z <- 1:64   # top-left corner, zoomed
png_fig("fig07-borders.png", 1700, 640, {
  par(mfrow = c(1, 3))
  show(img[z, z], "input (top-left corner)")
  show(bz[z, z], "box blur × 10, zeros outside")
  show(br[z, z], "box blur × 10, copy the edge")
})

## ---- fig08: noise -- blur first, then edges ----------------------------------
# A synthetic "cell" (bright disk with a darker nucleus) plus noise, so the true edges are known.
m <- 128
d1 <- outer(1:m, 1:m, function(i, j) sqrt((i - 64)^2 + (j - 64)^2))
d2 <- outer(1:m, 1:m, function(i, j) sqrt((i - 58)^2 + (j - 70)^2))
cell <- ifelse(d1 < 45, 180, 60); cell[d2 < 18] <- 110
set.seed(7)
noisy <- cell + matrix(rnorm(m * m, 0, 30), m)
edgemag <- function(x) sqrt(filter3(x, kern$sobelx)^2 + filter3(x, kern$sobely)^2)
e1 <- edgemag(noisy)
e2 <- edgemag(rep_n(noisy, kern$gauss, 2, "replicate"))
ring <- abs(d1 - 45) < 1.5            # pixels on the cell outline
flat <- d1 > 52 & d1 < 60             # background, away from any edge
cat(sprintf("fig08 mean edge strength on the outline / in the background: edges only %.0f / %.0f (ratio %.1f), Gaussian x2 then edges %.0f / %.0f (ratio %.1f)\n",
            mean(e1[ring]), mean(e1[flat]), mean(e1[ring]) / mean(e1[flat]),
            mean(e2[ring]), mean(e2[flat]), mean(e2[ring]) / mean(e2[flat])))
png_fig("fig08-blur-then-edges.png", 1700, 640, cred = FALSE, {
  par(mfrow = c(1, 3))
  show(noisy, "noisy synthetic cell (noise SD 30)")
  show(255 * e1 / max(e1), "edges (Sobel) directly")
  show(255 * e2 / max(e2), "Gaussian × 2, then edges")
})

## ---- fig09: kernels in frequency space ----------------------------------------
spec <- function(k, m = 64) {
  p <- matrix(0, m, m); p[1:3, 1:3] <- k
  a <- Mod(fft(p))
  a[c((m / 2 + 1):m, 1:(m / 2)), c((m / 2 + 1):m, 1:(m / 2))]   # centre = frequency 0
}
sg <- spec(kern$gauss); sl <- spec(kern$laplace); sb <- spec(kern$box)
cat(sprintf("fig09 |response| at the centre / at the corner: Gaussian %.2f / %.2f, Laplacian %.2f / %.2f\n",
            sg[33, 33], sg[1, 1], sl[33, 33], sl[1, 1]))
png_fig("fig09-frequency-response.png", 1500, 600, cred = FALSE, {
  par(mfrow = c(1, 2), mar = c(0.3, 0.3, 2.2, 3))
  show(255 * sg / max(sg), "Gaussian blur: passes the centre")
  show(255 * sl / max(sl), "Laplacian: blocks the centre")
})
cat("\nwrote fig02, fig05-fig09\n")
