# Quantitative biology and integrative omics (3MB00A): course site sources

Teacher information. This file is not part of the published site.

## Working with the exercises

Each exercise pairs a short `.qmd` walkthrough with worked R code:

- The walkthrough holds the prose, the hints (as collapsible callouts), and a reference solution.
- Code chunks are written in R; students run them and adapt them to the exercise data.

## Building this site

```bash
make           # render the whole site to docs/
make preview   # start a live-reload preview server
make clean     # delete docs/ and the Quarto cache
```

You will need [Quarto](https://quarto.org/docs/get-started/) and a recent
[R](https://cran.r-project.org/) installation.
