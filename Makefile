.PHONY: all render preview clean gitadd help

# Default: render the site, then stage every source file in git.
all: render gitadd

render:
	quarto render
	@touch docs/.nojekyll

preview:
	quarto preview

# Remove the rendered site and Quarto's cache.
clean:
	rm -rf docs .quarto

# Stage every source file AND the built HTML (docs/) so the committed site is
# always current. The .quarto/ cache is never added (it is .gitignored).
gitadd:
	git add _quarto.yml Makefile styles.css theme.scss .gitignore
	git add .github/workflows/*.yml
	git add *.qmd *.md
	git add intro/*.qmd
	@if ls intro/images/* >/dev/null 2>&1; then git add intro/images/*; fi
	git add day*/*.qmd
	git add docs

help:
	@echo "Targets:"
	@echo "  make           render the site, then git add all source files"
	@echo "  make render    render the whole site to _site/"
	@echo "  make preview   start a live-reload preview server"
	@echo "  make gitadd    stage all source files in git"
	@echo "  make clean     remove _site/ and .quarto/"
