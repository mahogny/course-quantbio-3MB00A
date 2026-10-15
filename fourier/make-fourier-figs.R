# Image figures for the Fourier lecture (fourier/lec.qmd).
#
# Re-run by hand from this folder (it is NOT run by `quarto render`):
#   cd fourier && Rscript make-fourier-figs.R
#
# Uses the full-size micrograph from ../matrix-images/ (downloaded there if
# missing; it is .gitignored).
#
# Image: transmission electron micrograph of a mesenchymal stem cell,
# Robert M. Hunt, CC BY 3.0, via Wikimedia Commons
# https://commons.wikimedia.org/wiki/File:MSC_high_magnification.jpg

credit <- "Image: Robert M. Hunt, CC BY 3.0, via Wikimedia Commons"

## ---- the image ------------------------------------------------------------

orig_file <- "../matrix-images/msc-original.jpg"
if (!file.exists(orig_file)) {
  download.file("https://upload.wikimedia.org/wikipedia/commons/5/52/MSC_high_magnification.jpg",
                orig_file, mode = "wb")
}
big <- jpeg::readJPEG(orig_file)          # 2400 x 1803, greyscale
if (length(dim(big)) == 3) big <- big[, , 1]

# block-average 5 x 5 pixel blocks -> 480 x 360
f  <- 5
nr <- nrow(big) %/% f
nc <- ncol(big) %/% f
big <- big[1:(nr * f), 1:(nc * f)]
img <- matrix(colMeans(matrix(aperm(array(big, c(f, nr, f, nc)), c(1, 3, 2, 4)), f * f)), nr, nc)
img <- (img - min(img)) / diff(range(img))   # stretch contrast to 0..1

## ---- helpers --------------------------------------------------------------

# Show a matrix as a greyscale picture (row 1 at the top), scaled to 0..1.
show <- function(m, main) {
  m <- (m - min(m)) / diff(range(m))
  plot.new()
  plot.window(c(0, ncol(m)), c(0, nrow(m)), asp = 1)
  rasterImage(as.raster(m), 0, 0, ncol(m), nrow(m), interpolate = FALSE)
  title(main = main, font.main = 1, cex.main = 1.15, line = 0.6)
}

fig <- function(file, w, h, ncols, expr) {
  png(file, width = w, height = h, res = 230)        # large res = larger text on slides
  par(mfrow = c(1, ncols), mar = c(0.4, 0.4, 2.2, 0.4), oma = c(1.2, 0, 0, 0))
  expr
  mtext(credit, side = 1, outer = TRUE, line = 0.2, cex = 0.75, col = "grey40", adj = 1)
  dev.off()
}

## ---- a periodic stripe artefact -------------------------------------------

# A whole number of cycles across the image, so the stripe is exactly two
# coefficients in the 2D Fourier spectrum (one at +k, one at -k).
kx <- 30                                   # cycles across the width
ky <- 18                                   # cycles down the height
rows <- (seq_len(nr) - 1) / nr
cols <- (seq_len(nc) - 1) / nc
stripe <- 0.15 * sin(2 * pi * outer(rows * ky, cols * kx, "+"))
noisy <- img + stripe

# Notch filter: zero the two stripe coefficients, transform back.
# fft() of a matrix is the 2D transform; index 1 is frequency 0.
F <- fft(noisy)
F[1 + ky, 1 + kx] <- 0
F[1 + (nr - ky) %% nr, 1 + (nc - kx) %% nc] <- 0
cleaned <- Re(fft(F, inverse = TRUE)) / (nr * nc)
# The notch also removes the image's own (tiny) content at those two
# frequencies, so the result is very close to, not exactly, the original.
cat(sprintf("stripe removal: max |cleaned - original| = %.4f (stripe amplitude 0.15)\n",
            max(abs(cleaned - img))))

## ---- compression: keep only the largest coefficients ----------------------

keep <- 0.03                               # keep 3% of the coefficients
G <- fft(img)
cut <- quantile(Mod(G), 1 - keep)
compressed <- Re(fft(G * (Mod(G) >= cut), inverse = TRUE)) / (nr * nc)

## ---- figures --------------------------------------------------------------

fig("fig02-cell-with-stripes.png", 900, 1000, 1, {
  show(noisy, "micrograph + periodic stripe")
})

fig("fig09-compression.png", 1500, 1000, 2, {
  show(img, "original")
  show(compressed, sprintf("%g%% of coefficients kept", 100 * keep))
})

fig("fig10-stripe-removed.png", 1500, 1000, 2, {
  show(noisy, "with stripe")
  show(cleaned, "stripe removed")
})

cat("done\n")
