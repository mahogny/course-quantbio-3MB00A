.PHONY: all render preview clean gitadd help figs demos typecheck

# Default: render the site, then stage every source file in git.
all: render gitadd

render: demos
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
	cd scrna-log && Rscript make-log-figs.R
	cd ctmc && Rscript make-ctmc-figs.R

# Build the interactive demos (TypeScript, demos/src/) into demos/dist/.
# One-time setup: npm i   (installs esbuild + typescript into node_modules/).
demos:
	demos/build.sh

# Type-check the demo sources (esbuild only strips types, it does not check them).
typecheck:
	npx --no-install tsc --noEmit -p demos

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
	@echo "  make demos     build the interactive demos into demos/dist/ (needs npm i once)"
	@echo "  make typecheck type-check the demo TypeScript sources"
	@echo "  make figs      re-generate the R-made figures (matrix-images, polar, compensation, fourier, scrna-log, ctmc)"
	@echo "  make gitadd    stage all source files in git"
	@echo "  make clean     remove docs/ and .quarto/"
