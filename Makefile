.PHONY: all render preview clean gitadd help figs

# Default: render the site, then stage every source file in git.
all: render gitadd

render:
	quarto render
	@touch docs/.nojekyll

preview:
	quarto preview

# Re-generate the R-made figures (not run by quarto render).
figs:
	cd matrix-images && Rscript make-image-figs.R
	cd polar && Rscript make-polar-figs.R
	cd compensation && Rscript make-comp-figs.R
	cd fourier && Rscript make-fourier-figs.R

# Remove the rendered site and Quarto's cache.
clean:
	rm -rf docs .quarto

# Stage every source file AND the built HTML (docs/) so the committed site is
# always current. The .quarto/ cache is never added (it is .gitignored).
gitadd:
	git add -- .

help:
	@echo "Targets:"
	@echo "  make           render the site, then git add all source files"
	@echo "  make render    render the whole site to docs/"
	@echo "  make preview   start a live-reload preview server"
	@echo "  make figs      re-generate the R-made figures (matrix-images, polar, compensation, fourier)"
	@echo "  make gitadd    stage all source files in git"
	@echo "  make clean     remove docs/ and .quarto/"
