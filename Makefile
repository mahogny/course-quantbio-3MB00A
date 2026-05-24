.PHONY: all render preview clean gitadd help

# Default: render the site, then stage every source file in git.
all: render gitadd

render:
	quarto render

preview:
	quarto preview

# Remove the rendered site and Quarto's caches.
clean:
	rm -rf _site .quarto

# Stage every source file the site is built from. The generated _site/ and
# .quarto/ are never added (they are .gitignored). Run after a render so the
# staged sources are known to build.
gitadd:
	git add _quarto.yml Makefile styles.css theme.scss .gitignore
	git add .github/workflows/*.yml
	git add *.qmd *.md
	git add intro/*.qmd
	@if ls intro/images/* >/dev/null 2>&1; then git add intro/images/*; fi
	git add day*/*.qmd

help:
	@echo "Targets:"
	@echo "  make           render the site, then git add all source files"
	@echo "  make render    render the whole site to _site/"
	@echo "  make preview   start a live-reload preview server"
	@echo "  make gitadd    stage all source files in git"
	@echo "  make clean     remove _site/ and .quarto/"
