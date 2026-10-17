# Slide editor

Edit the course pages in the browser: slide text, exercise and quiz text, and
the labels inside the SVG figures, without hunting for which file a word lives
in. You can also leave notes about edits for an LLM to make later.

```sh
make edit-slides            # or: node tools/slide-editor/server.mjs --port 8737
```

It prints a URL such as `http://beagle:8737/editor-sandbox/lec.html?token=…`.
Open it from any machine that can reach the server. The token is random per
start unless `SLIDE_EDIT_TOKEN` is set; the first visit stores it in a cookie,
so the rest of the site works without it. The connection is plain HTTP; use an
SSH tunnel (`ssh -L 8737:localhost:8737 beagle`) if that matters.

## On any page made from a .qmd/.md

The toolbar sits top left on slides (with ◀ ▶ to step slides) and bottom left
on other pages.

- **✎ Edit** (orange = on):
  - click a **label in a figure**, type, then Enter to save or Esc to cancel.
    The figure updates as you type. An empty label plus Enter deletes it.
  - click **any other text** to open the source in a side panel with the
    cursor (and a tinted line) on that text. On slides the panel holds the
    current slide's markdown, notes included; on other pages the whole file.
    Save & render (Ctrl+S) writes the file, re-renders the page (a few
    seconds) and reloads at the same place.
- **Source**: opens the same panel without clicking text.
- **Notes**: write down what should change, for an LLM to do later.
  **Shift+click** any text or figure label to attach it to the note. The box
  can be dragged by its header. Notes are saved in
  `edit-notes/<batch>_<unit>_<page>.json`; **Hand over** closes the batch so
  it can be acted on, and new notes go into a new batch. The protocol for
  whoever acts on them is in `edit-notes/README.md`.

`editor-sandbox/` holds a practice deck (`lec.html`) and a practice exercise
page (`exercise.html`) with copies of real content; they are not linked from
the site or its search. `git checkout editor-sandbox/ docs/editor-sandbox/`
resets them.

## What it can change

- `.qmd`/`.md` page sources in unit folders and at the top level.
- The SVGs in unit folders that are written by hand. SVGs whose file name
  appears in an `.R` script in the same folder are made by that script, so
  they are locked (dashed outline); change the script instead.
- `edit-notes/*.json`.

A label edit replaces exactly one string in the SVG file and its `docs/`
copy, so `git diff` shows one changed line. Saves check that the file still
holds the text the page loaded; if not, you are asked to reload.

## How it works

`server.mjs` (Node, no dependencies) serves `docs/` and adds `editor.js` to
every HTML page; nothing is added to the published site. The script swaps each
`<img>` of an editable SVG for the SVG itself, so the labels become clickable.
After a source save the server runs `quarto render <file>`; set `QUARTO` to
use another binary, and `TMPDIR` if the default temp disk is full.
