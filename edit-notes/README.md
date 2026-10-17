# Edit notes

Notes written in the slide editor (`make edit-slides`, see
`tools/slide-editor/README.md`) about changes to make to the course pages:
lecture slides, exercises, quizzes and other pages.
They are instructions for whoever does the edits, usually an LLM.

## Files

One JSON file per page per batch: `<batch>_<unit>_<page>.json`, where
`<batch>` is the time the batch was started (`2026-10-17T143205`), e.g.
`2026-10-17T143205_pca_lec.json` for `pca/lec.qmd`.

```json
{
  "page": "pca/lec.qmd",
  "batch": "2026-10-17T143205",
  "status": "closed",
  "created": "...", "updated": "...", "closed": "...",
  "notes": [
    {
      "id": "a1b2c3d4",
      "slide": 3,
      "title": "Why not just look at genes one at a time?",
      "source": "pca/lec.qmd:57",
      "anchor": "Any single gene is noisy and captures only a sliver of the biology.",
      "figure": "pca/fig03-pairwise-explosion.svg",
      "note": "Say why noise matters here; shorten the bullet.",
      "created": "..."
    }
  ]
}
```

On pages that are not slides (exercises, quizzes, ...) a note has `section`
(the heading the clicked text is under) instead of `slide` and `title`:

```json
{ "id": "7f4af84e", "section": "By hand", "source": "vectors-projection/exercise.qmd:43",
  "anchor": "Use these vectors throughout ...", "note": "...", "created": "..." }
```

- `slide` is reveal's slide index (0 = title slide, so slide 3 is the 4th).
- `title` (slides) or `section` (other pages) and `source` (file:line of that
  heading when the note was written) locate the place. Lines move as the file
  is edited, so find it by the heading text.
- `anchor` (optional) is the text the author clicked: rendered slide text,
  without markdown (maths comes out garbled), or a figure label. `figure` is set when the anchor is in an
  SVG figure (or the anchor is "(figure)" for the figure as a whole).
- `note` is the instruction.

## Protocol

- `"status": "open"`: the author is still writing this batch. Do not act on it
  or delete it unless asked to.
- `"status": "closed"`: handed over. Act on every note, then **delete the
  file**. If a note cannot be done, or needs a decision, leave the file and
  report back instead of guessing.
- Work on the oldest closed batch first.
- The usual course rules apply to the edits: keep the speaker notes in line
  with the slides, fix the matching exercise/quiz if they repeat the wording,
  re-render the page, and only `git add` (do not commit).
- Figures made by an R script (its name appears in a `.R` file in the unit
  folder) are changed in the script, then regenerated with `make figs`.
