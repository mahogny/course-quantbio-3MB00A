// Slide editor, browser side. Injected by server.mjs into every page of the
// site. On a page rendered from a .qmd/.md in the repo it adds a toolbar:
//
// - SVG figures are swapped from <img> to inline <svg>, so each label can be
//   clicked and edited in place. Saving sends (file, label index, old text,
//   new text) to the server, which replaces that one string.
// - Clicking text opens the source in a side panel, cursor on that text: the
//   current slide's markdown on a reveal.js deck, the whole file otherwise.
// - Notes (Shift+click attaches text) are saved in edit-notes/ for later.

(async () => {
  const pageInfo = await fetch("/__editor/page?url=" + encodeURIComponent(location.pathname)).then((r) => r.json()).catch(() => null);
  if (!pageInfo || !pageInfo.ok) return;
  const SRC = pageInfo.source;          // e.g. "pca/lec.qmd"
  const DECK = !!window.Reveal;         // slides, or an ordinary page
  const MAIN = DECK ? null : document.querySelector("main#quarto-document-content, main") || document.body;
  // The part of the page that is content (not navbar, sidebar or TOC).
  const inContent = (el) => DECK ? el.closest(".reveal .slides section") : MAIN.contains(el) && !el.closest("#TOC, nav, .callout-header, .quarto-title-meta");

  // ------------------------------------------------------------ styles + chrome

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/__editor/editor.css";
  document.head.appendChild(css);

  const bar = document.createElement("div");
  bar.className = "se-bar" + (DECK ? "" : " se-bar-page");
  bar.innerHTML = `
    ${DECK ? `<button type="button" data-act="prev" title="Previous slide">◀</button>
    <span class="se-num"></span>
    <button type="button" data-act="next" title="Next slide">▶</button>` : ""}
    <button type="button" data-act="labels" title="Click text to edit its source; click labels in figures to edit them">✎ Edit</button>
    <button type="button" data-act="source" title="Edit the markdown of this ${DECK ? "slide" : "page"}">${DECK ? "Slide source" : "Source"}</button>
    <button type="button" data-act="notes" title="Notes for later edits (Shift+click text to attach it)">Notes</button>
    <span class="se-status"></span>`;
  document.body.appendChild(bar);
  const status = bar.querySelector(".se-status");
  const labelsBtn = bar.querySelector('[data-act="labels"]');

  // Problems in the browser are echoed to the server's terminal.
  const report = (msg) => { try { navigator.sendBeacon("/__editor/log", JSON.stringify({ msg: String(msg), ua: navigator.userAgent, url: location.pathname + location.hash })); } catch {} };
  window.addEventListener("error", (e) => report(`${e.message} at ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) => report(e.reason && (e.reason.stack || e.reason)));

  let toastTimer = 0;
  function say(msg, kind = "") {
    status.textContent = msg;
    status.className = "se-status " + kind;
    clearTimeout(toastTimer);
    if (kind !== "busy") toastTimer = setTimeout(() => { status.textContent = ""; }, kind === "err" ? 12000 : 3000);
  }

  let labelsOn = true;
  try { labelsOn = sessionStorage.getItem("se-labels") !== "off"; } catch {}
  function setLabels(on) {
    labelsOn = on;
    document.body.classList.toggle("se-on", on);
    labelsBtn.classList.toggle("se-active", on);
    try { sessionStorage.setItem("se-labels", on ? "on" : "off"); } catch {}
  }
  setLabels(labelsOn);

  // Keys typed into editor widgets must not reach reveal.js.
  const shield = (el) => ["keydown", "keyup", "keypress"].forEach((t) =>
    el.addEventListener(t, (e) => e.stopPropagation()));

  async function call(method, route, body) {
    const r = await fetch("/__editor/" + route, {
      method, headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let j;
    try { j = await r.json(); } catch { j = { ok: false, error: `HTTP ${r.status}` }; }
    if (!r.ok && j.ok !== false) j = { ok: false, error: `HTTP ${r.status}` };
    return j;
  }

  // ------------------------------------------------------------ inline SVGs

  const runIndex = new WeakMap(); // text node -> label index in its file
  const svgPath = new WeakMap();  // inline svg -> repo-relative path
  let figCount = 0;

  function relPath(img) {
    const src = img.getAttribute("src") || "";
    if (!/\.svg(\?|#|$)/i.test(src)) return null;
    const p = new URL(src, location.href).pathname.replace(/^\//, "");
    return /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.svg$/.test(p) ? p : null;
  }

  // Give every id a per-figure prefix so markers and gradients from different
  // figures on the page do not clash.
  function prefixIds(svg, pre) {
    const ids = new Map();
    svg.querySelectorAll("[id]").forEach((el) => { ids.set(el.id, pre + el.id); el.id = pre + el.id; });
    if (!ids.size) return;
    const fix = (v) => v.replace(/url\(\s*#([^)\s]+)\s*\)/g, (s, id) => ids.has(id) ? `url(#${ids.get(id)})` : s);
    svg.querySelectorAll("*").forEach((el) => {
      for (const a of [...el.attributes]) {
        if ((a.localName === "href") && a.value.startsWith("#") && ids.has(a.value.slice(1)))
          el.setAttributeNS(a.namespaceURI, a.name, "#" + ids.get(a.value.slice(1)));
        else if (a.value.includes("url(")) el.setAttribute(a.name, fix(a.value));
      }
      if (el.localName === "style") {
        let t = fix(el.textContent);
        for (const [id, nid] of ids) t = t.replace(new RegExp(`#${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g"), "#" + nid);
        el.textContent = t;
      }
    });
  }

  function textRuns(svg) {
    const runs = [];
    svg.querySelectorAll("text").forEach((t) => {
      const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) if (n.data.trim()) runs.push(n);
    });
    return runs;
  }

  async function inlineFigure(img) {
    const rel = relPath(img);
    if (!rel || img.dataset.seDone) return;
    img.dataset.seDone = "1";
    const info = await call("GET", "svg-info?path=" + encodeURIComponent(rel));
    if (!info.editable) {
      img.title = `Not editable here: ${info.reason || "unknown"}`;
      img.classList.add("se-locked");
      return;
    }
    if (!DECK) return inlinePageFigure(img, rel, info);
    if (!img.complete) await new Promise((r) => { img.onload = img.onerror = r; });
    // Quarto marks a slide's only image r-stretch, and reveal sizes it to the
    // space left on the slide only once the slide is laid out (height 0
    // before that). Ask reveal to lay out, then wait up to ~5 s for a size.
    if (img.classList.contains("r-stretch") && !img.offsetHeight) Reveal.layout();
    let w = 0, h = 0;
    for (let i = 0; i < 25; i++) {
      w = img.offsetWidth; h = img.offsetHeight;
      if (w && h) break;
      await new Promise((r) => setTimeout(r, 200));
      if (i === 4) Reveal.layout();
    }
    if (!w || !h) {
      report(`${rel}: image has no size (w=${w} h=${h} complete=${img.complete} natural=${img.naturalWidth}x${img.naturalHeight})`);
      delete img.dataset.seDone;
      return;
    }

    const svg = await buildSvg(rel, info);
    if (typeof svg === "string") {
      img.title = svg;
      img.classList.add("se-locked");
      return report(`${rel}: ${svg}`);
    }
    const cs = getComputedStyle(img);
    // Drop r-stretch, or reveal would resize the inline figure on its own.
    svg.setAttribute("class", ((img.getAttribute("class") || "").replace(/\br-stretch\b/, "") + " se-svg").trim());
    svg.style.width = w + "px";
    svg.style.height = h + "px";
    svg.style.display = cs.display === "block" ? "block" : "inline-block";
    svg.style.verticalAlign = cs.verticalAlign;
    for (const k of ["marginTop", "marginRight", "marginBottom", "marginLeft"]) svg.style[k] = cs[k];
    img.replaceWith(svg);
  }

  // On an ordinary page the figure may sit in a collapsed callout (no size
  // yet), so copy the image's own sizing instead of measuring it.
  async function inlinePageFigure(img, rel, info) {
    const svg = await buildSvg(rel, info);
    if (typeof svg === "string") {
      img.title = svg;
      img.classList.add("se-locked");
      return report(`${rel}: ${svg}`);
    }
    svg.setAttribute("class", ((img.getAttribute("class") || "") + " se-svg").trim());
    if (img.getAttribute("style")) svg.setAttribute("style", img.getAttribute("style"));
    for (const a of ["width", "height"]) if (img.hasAttribute(a)) svg.setAttribute(a, img.getAttribute(a));
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    img.replaceWith(svg);
  }

  // Fetch the SVG and make an inline copy whose labels are numbered like the
  // server's. Returns an error message instead if they do not line up.
  async function buildSvg(rel, info) {
    const txt = await (await fetch("/" + rel + "?t=" + Date.now(), { cache: "no-store" })).text();
    const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg") return "Could not parse this SVG";
    const svg = document.importNode(doc.documentElement, true);
    const runs = textRuns(svg);
    if (info.labels && (info.labels.length !== runs.length || info.labels.some((t, i) => t !== runs[i].data)))
      return "Labels in this SVG could not be matched to the file; edit it as text";
    runs.forEach((n, i) => runIndex.set(n, i));
    prefixIds(svg, `se${++figCount}-`);
    svgPath.set(svg, rel);
    svg.addEventListener("click", onFigureClick);
    return svg;
  }

  // After a delete the numbering of labels changes: rebuild from the file.
  async function reloadFigure(old) {
    const rel = svgPath.get(old);
    const info = await call("GET", "svg-info?path=" + encodeURIComponent(rel));
    const svg = info.editable ? await buildSvg(rel, info) : "not editable";
    if (typeof svg === "string") return say(`Saved, but reload the page to keep editing this figure (${svg})`, "err");
    svg.setAttribute("class", old.getAttribute("class"));
    svg.setAttribute("style", old.getAttribute("style"));
    old.replaceWith(svg);
  }

  async function processSlide(slide) {
    if (!slide) return;
    const imgs = [...slide.querySelectorAll("img")];
    await Promise.all(imgs.map((img) => inlineFigure(img).catch((e) => { say(String(e), "err"); report(e.stack || e); })));
    if (!labelsOn || (DECK && slide !== Reveal.getCurrentSlide())) return;
    const where = DECK ? "slide" : "page";
    const n = slide.querySelectorAll("svg.se-svg").length, locked = slide.querySelectorAll("img.se-locked").length;
    if (n) say(`${n} figure${n > 1 ? "s" : ""} with editable labels on this ${where} (labels turn orange on hover)`);
    else if (locked) say(`The figure${locked > 1 ? "s" : ""} on this ${where} ${locked > 1 ? "are" : "is"} locked (made by an R script)`);
  }

  // ------------------------------------------------------------ label editing

  function nodeRect(node) {
    const r = document.createRange();
    r.selectNodeContents(node);
    const b = r.getBoundingClientRect();
    return b.width || b.height ? b : node.parentNode.getBoundingClientRect();
  }

  function onFigureClick(e) {
    if (!labelsOn) return;
    const el = e.target.closest("text, tspan");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    let cands = [...el.childNodes].filter((n) => runIndex.has(n));
    if (!cands.length) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) if (runIndex.has(n)) cands.push(n);
    }
    if (!cands.length) return;
    const hit = cands.find((n) => {
      const b = nodeRect(n);
      return e.clientX >= b.left - 2 && e.clientX <= b.right + 2 && e.clientY >= b.top - 2 && e.clientY <= b.bottom + 2;
    }) || cands[0];
    openLabel(hit, e.currentTarget);
  }

  let openInput = null;

  function openLabel(node, svg) {
    if (openInput) openInput.blur();
    const original = node.data;
    const lead = original.match(/^\s*/)[0], trail = original.match(/\s*$/)[0];
    const core = original.trim();
    const b = nodeRect(node);
    const input = document.createElement("input");
    input.className = "se-input";
    input.value = core;
    input.placeholder = "empty + Enter deletes this label";
    const fs = Math.max(11, b.height * 0.8);
    Object.assign(input.style, {
      left: b.left - 4 + "px", top: b.top - 3 + "px", height: b.height + 6 + "px",
      width: Math.max(b.width + fs * 3, 120) + "px", fontSize: fs + "px",
    });
    shield(input);
    document.body.appendChild(input);
    openInput = input;
    input.focus();
    input.select();
    node.parentNode.classList.add("se-editing");

    let done = false;
    const close = () => {
      done = true;
      node.parentNode.classList.remove("se-editing");
      input.remove();
      if (openInput === input) openInput = null;
    };
    const cancel = () => { node.data = original; close(); };
    // Enter saves; Enter on an empty box deletes the label. Leaving the box
    // (blur) saves a change but never deletes.
    const commit = async (enter) => {
      if (done) return;
      const value = input.value;
      if (value === core) return close();
      const rel = svgPath.get(svg);
      if (!value.trim()) {
        if (!enter) return cancel();
        close();
        node.data = "";
        const r = await call("POST", "svg-text", { path: rel, index: runIndex.get(node), old: original, new: "" });
        if (!r.ok) { node.data = original; return say(`Not deleted: ${r.error}`, "err"); }
        say(`Deleted from ${rel}`, "ok");
        return reloadFigure(svg);
      }
      close();
      const now = lead + value + trail;
      node.data = now;
      const r = await call("POST", "svg-text", { path: rel, index: runIndex.get(node), old: original, new: now });
      if (r.ok) say(`Saved ${rel}`, "ok");
      else { node.data = original; say(`Not saved: ${r.error}`, "err"); }
    };
    input.addEventListener("input", () => { node.data = lead + input.value + trail; }); // live preview
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    input.addEventListener("blur", () => commit(false));
  }

  // ------------------------------------------------------------ slide source

  let panel = null;
  let panelSlide = null;

  // The line holding the caret gets a tinted band behind the (transparent)
  // textarea. A hidden mirror with the same font and width tells where that
  // line sits, wrapped rows included.
  function lineBox(ta) {
    const v = ta.value, at = ta.selectionStart;
    const start = v.lastIndexOf("\n", at - 1) + 1;
    let end = v.indexOf("\n", at);
    if (end < 0) end = v.length;
    const cs = getComputedStyle(ta);
    const mirror = document.createElement("div");
    for (const k of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth",
      "borderBottomWidth", "borderLeftWidth", "boxSizing", "wordBreak", "overflowWrap"]) mirror.style[k] = cs[k];
    Object.assign(mirror.style, { position: "absolute", visibility: "hidden", top: "0", left: "-9999px",
      whiteSpace: "pre-wrap", boxSizing: "border-box", borderStyle: "solid",
      width: ta.clientWidth + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + "px" });
    mirror.textContent = v.slice(0, start);
    const span = document.createElement("span");
    span.textContent = v.slice(start, end) || " ";
    mirror.appendChild(span);
    document.body.appendChild(mirror);
    const box = { top: span.offsetTop, height: span.offsetHeight };
    mirror.remove();
    return box;
  }

  function updateBand(ta, scroll) {
    const band = ta.parentNode.querySelector(".se-band");
    if (!band) return;
    const b = lineBox(ta);
    if (scroll) ta.scrollTop = Math.max(0, b.top - ta.clientHeight / 3);
    band.style.top = b.top - ta.scrollTop + "px";
    band.style.height = b.height + "px";
  }

  // Put the cursor on the source line that holds the clicked text. The match
  // ignores markdown punctuation, so "**200 million** pairwise" is found from
  // the rendered "200 million pairwise".
  // On a page, `section` (the heading above the clicked text) is found first
  // and the text is looked for after it, so repeated phrases land right.
  function findText(value, hint, from = 0) {
    const words = (hint || "").toLowerCase().match(/[\p{L}\p{N}]+/gu);
    if (!words) return -1;
    const src = value.toLowerCase();
    const plain = [], map = [];
    for (let i = from; i < src.length; i++) if (/[\p{L}\p{N}\s]/u.test(src[i])) { plain.push(src[i]); map.push(i); }
    const text = plain.join("").replace(/\s/g, " ");
    for (let n = Math.min(words.length, 8); n >= Math.min(2, words.length); n--) {
      for (let k = 0; k + n <= words.length; k++) {
        const m = new RegExp(words.slice(k, k + n).join("\\s+"), "u").exec(text);
        if (m) return map[m.index];
      }
    }
    return -1;
  }

  function highlight(ta, hint, section) {
    let from = 0;
    if (section) {
      const h = findText(ta.value, section);
      if (h >= 0) from = ta.value.lastIndexOf("\n", h) + 1;
    }
    let at = findText(ta.value, hint, from);
    if (at < 0 && from) at = findText(ta.value, hint);
    if (at < 0) at = from;
    if (!hint && !section) return;
    ta.focus();
    ta.setSelectionRange(at, at);
    updateBand(ta, true);
  }

  // The heading that a page element sits under (for pages, not slides).
  function sectionOf(el) {
    const heads = [...MAIN.querySelectorAll("h1, h2, h3, h4")];
    let best = null;
    for (const h of heads) {
      if (h === el || h.contains(el) || (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) best = h;
      else break;
    }
    return best ? best.textContent.replace(/\s+/g, " ").trim() : "";
  }
  // The heading nearest the top of the window.
  function sectionInView() {
    let best = null;
    for (const h of MAIN.querySelectorAll("h1, h2, h3, h4")) { if (h.getBoundingClientRect().top < 140) best = h; else break; }
    return best ? best.textContent.replace(/\s+/g, " ").trim() : (MAIN.querySelector("h1, h2")?.textContent.trim() || "");
  }

  // Returns false if the user chose to keep unsaved edits.
  const closePanel = () => {
    if (panel) {
      const ta = panel.querySelector("textarea");
      if (ta.value !== panel.savedText && !confirm("Discard your unsaved changes to the source?")) return false;
      panel.remove();
    }
    panel = null; panelSlide = null;
    document.body.classList.remove("se-panel-open");
    return true;
  };

  async function openSource(hint, section) {
    const cur = DECK ? Reveal.getCurrentSlide() : MAIN;
    if (panel && hint === undefined) return closePanel();         // toolbar button toggles
    if (panel && panelSlide === cur) return highlight(panel.querySelector("textarea"), hint, section);
    if (!closePanel()) return;
    let h = null, title = "", r;
    if (DECK) {
      h = Reveal.getIndices().h;
      if (h === 0) return say("The title slide comes from the YAML header at the top of " + SRC, "err");
      title = cur.querySelector("h1, h2")?.textContent.trim() || "";
      r = await call("GET", `slide?path=${encodeURIComponent(SRC)}&h=${h}&title=${encodeURIComponent(title)}`);
    } else {
      r = await call("GET", `source?path=${encodeURIComponent(SRC)}`);
      if (hint === undefined) section = sectionInView();
    }
    if (!r.ok) return say(r.error, "err");

    panel = document.createElement("div");
    panel.className = "se-panel";
    panel.innerHTML = `
      <div class="se-panel-head">
        <strong>${SRC}</strong> ${r.line ? `<span>line ${r.line}</span>` : ""}
        <span class="se-grow"></span>
        <button type="button" data-act="save">Save &amp; render</button>
        <button type="button" data-act="close">Close</button>
      </div>
      ${r.warning ? `<div class="se-warn"></div>` : ""}
      <div class="se-ta-wrap"><div class="se-band"></div><textarea spellcheck="true"></textarea></div>
      <pre class="se-log" hidden></pre>
      <div class="se-hint">Ctrl+S saves. The ${DECK ? "deck" : "page"} is re-rendered and reloads ${DECK ? "on this slide" : "at the same place"}.</div>`;
    if (r.warning) panel.querySelector(".se-warn").textContent = r.warning;
    const ta = panel.querySelector("textarea");
    ta.value = r.text;
    panel.savedText = r.text;
    shield(panel);
    document.body.appendChild(panel);
    panelSlide = cur;
    document.body.classList.add("se-panel-open");
    ta.focus();
    const band = () => requestAnimationFrame(() => updateBand(ta));
    for (const t of ["input", "keyup", "click", "scroll", "select", "focus"]) ta.addEventListener(t, band);
    new ResizeObserver(band).observe(ta);
    ta.setSelectionRange(0, 0);
    updateBand(ta);
    highlight(ta, hint, section);

    const save = async () => {
      if (ta.value === r.text) return say("No changes");
      const t0 = Date.now();
      const s = DECK ? await call("POST", "slide", { path: SRC, h, title, old: r.text, new: ta.value })
        : await call("POST", "source", { path: SRC, old: r.text, new: ta.value });
      if (!s.ok) return say(`Not saved: ${s.error}`, "err");
      r.text = ta.value;
      panel.savedText = ta.value;
      say("Saved; rendering…", "busy");
      waitRender(t0, panel.querySelector(".se-log"));
    };
    panel.querySelector('[data-act="save"]').onclick = save;
    panel.querySelector('[data-act="close"]').onclick = closePanel;
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      if (e.key === "Escape") closePanel();
    });
  }

  async function waitRender(t0, logEl) {
    for (;;) {
      await new Promise((r) => setTimeout(r, 1000));
      let s;
      try { s = await call("GET", "render-status"); } catch { continue; }
      if (s.state === "running" || s.queued || s.finished < t0) continue;
      if (s.state === "done") {
        say("Rendered; reloading", "ok");
        try { sessionStorage.setItem("se-scroll", JSON.stringify({ path: location.pathname, y: scrollY })); } catch {}
        location.reload();
        return;
      }
      say("Render failed; see the log in the panel", "err");
      if (logEl) { logEl.hidden = false; logEl.textContent = s.log; }
      return;
    }
  }


  // ------------------------------------------------------------ edit notes
  //
  // Notes on what to change, saved by the server in edit-notes/ for an LLM to
  // act on later. Shift+click on slide text or a figure label opens the note
  // box with that text attached.

  const notesBtn = bar.querySelector('[data-act="notes"]');
  let notesData = { batch: null, files: [] };
  let noteBox = null;
  let noteAnchor = null; // { text, figure? }
  let notePos = null;    // where the box was dragged to

  function dragBox(box, handle) {
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = (m) => {
        notePos = { left: Math.max(0, Math.min(innerWidth - 60, m.clientX - dx)), top: Math.max(0, Math.min(innerHeight - 30, m.clientY - dy)) };
        placeBox(box);
      };
      const up = () => { removeEventListener("mousemove", move); removeEventListener("mouseup", up); };
      addEventListener("mousemove", move);
      addEventListener("mouseup", up);
    });
  }
  function placeBox(box) {
    if (!notePos) return;
    box.classList.add("se-moved");
    Object.assign(box.style, { left: notePos.left + "px", top: notePos.top + "px", right: "auto", bottom: "auto" });
  }

  async function loadNotes() {
    const r = await call("GET", "notes?page=" + encodeURIComponent(SRC));
    if (r.ok) notesData = r;
    showNoteCount();
  }

  // Notes for this slide (decks) or the whole page.
  function slideNotes(h) {
    const out = [];
    for (const f of notesData.files) for (const n of f.notes) if (!DECK || n.slide === h) out.push({ ...n, file: f.file, open: f.open });
    return out;
  }

  function showNoteCount() {
    const n = slideNotes(DECK ? Reveal.getIndices().h : null).length;
    notesBtn.textContent = n ? `Notes (${n})` : "Notes";
    notesBtn.classList.toggle("se-has-notes", n > 0);
  }

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function postNote(body) {
    const r = await call("POST", "notes", { page: SRC, ...body });
    if (!r.ok) say(`Note not saved: ${r.error}`, "err");
    await loadNotes();
    return r.ok;
  }

  function closeNotes() { if (noteBox) noteBox.remove(); noteBox = null; noteAnchor = null; }

  async function openNotes(anchor) {
    if (anchor !== undefined) noteAnchor = anchor;
    await loadNotes();
    const h = DECK ? Reveal.getIndices().h : null;
    const title = DECK ? Reveal.getCurrentSlide().querySelector("h1, h2")?.textContent.trim() || "(title slide)"
      : (noteAnchor?.section || sectionInView());
    const draft = noteBox?.querySelector(".se-note-new")?.value || "";
    if (noteBox) noteBox.remove();
    noteBox = document.createElement("div");
    noteBox.className = "se-notes";
    const list = slideNotes(h).map((n) => `
      <div class="se-note ${n.open ? "" : "se-note-closed"}" data-id="${n.id}">
        ${!DECK && n.section ? `<div class="se-note-meta">§ ${esc(n.section)}</div>` : ""}
        ${n.anchor ? `<div class="se-note-anchor">${n.figure ? `<span>${esc(n.figure.split("/").pop())}</span> ` : ""}“${esc(n.anchor)}”</div>` : ""}
        <div class="se-note-text">${esc(n.note)}</div>
        ${n.open ? `<div class="se-note-acts"><button type="button" data-act="edit">Edit</button><button type="button" data-act="del">Delete</button></div>`
          : `<div class="se-note-meta">handed over (${esc(n.file.replace("edit-notes/", ""))})</div>`}
      </div>`).join("");
    noteBox.innerHTML = `
      <div class="se-notes-head"><strong>Notes · ${DECK ? `slide ${h + 1}` : "this page"}</strong> <span>${esc(DECK ? title : SRC)}</span>
        <span class="se-grow"></span><button type="button" data-act="close">×</button></div>
      <div class="se-notes-list">${list || `<div class="se-note-meta">No notes on this ${DECK ? "slide" : "page"} yet.</div>`}</div>
      ${DECK ? "" : `<div class="se-note-meta">New note goes under § ${esc(title || "(top of page)")}</div>`}
      ${noteAnchor ? `<div class="se-note-anchor se-note-pending">${noteAnchor.figure ? `<span>${esc(noteAnchor.figure.split("/").pop())}</span> ` : ""}“${esc(noteAnchor.text)}” <button type="button" data-act="unanchor" title="Do not attach this text">×</button></div>` : ""}
      <textarea class="se-note-new" rows="3" placeholder="What should change here? (Ctrl+Enter adds)"></textarea>
      <div class="se-notes-foot">
        <button type="button" data-act="add">Add note</button>
        <span class="se-grow"></span>
        <span class="se-note-meta">${notesData.batch ? `batch ${esc(notesData.batch)}` : "new batch on first note"}</span>
        <button type="button" data-act="handover" title="Close this batch so an LLM can act on it; new notes go to a new batch">Hand over</button>
      </div>`;
    shield(noteBox);
    document.body.appendChild(noteBox);
    placeBox(noteBox);
    dragBox(noteBox, noteBox.querySelector(".se-notes-head"));
    const ta = noteBox.querySelector(".se-note-new");
    ta.value = draft;
    ta.focus();

    const add = async () => {
      if (!ta.value.trim()) return;
      const where = DECK ? { slide: h, title: title === "(title slide)" ? "" : title } : { section: title };
      const ok = await postNote({ action: "add", ...where, anchor: noteAnchor?.text, figure: noteAnchor?.figure, note: ta.value });
      if (ok) { ta.value = ""; noteAnchor = null; say("Note saved", "ok"); openNotes(); }
    };
    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); add(); }
      if (e.key === "Escape") closeNotes();
    });
    noteBox.addEventListener("click", async (e) => {
      const act = e.target.closest("button")?.dataset.act;
      const id = e.target.closest(".se-note")?.dataset.id;
      if (act === "close") closeNotes();
      if (act === "add") add();
      if (act === "unanchor") { noteAnchor = null; openNotes(); }
      if (act === "del" && id) { if (await postNote({ action: "delete", id })) openNotes(); }
      if (act === "edit" && id) {
        const box = e.target.closest(".se-note");
        const n = slideNotes(h).find((x) => x.id === id);
        box.querySelector(".se-note-text").innerHTML = `<textarea rows="3"></textarea>`;
        const et = box.querySelector("textarea");
        et.value = n.note;
        et.focus();
        box.querySelector(".se-note-acts").innerHTML = `<button type="button" data-act="save">Save</button><button type="button" data-act="cancel">Cancel</button>`;
        et.addEventListener("keydown", (k) => { if ((k.ctrlKey || k.metaKey) && k.key === "Enter") { k.preventDefault(); box.querySelector('[data-act="save"]').click(); } });
      }
      if (act === "save" && id) {
        const v = e.target.closest(".se-note").querySelector("textarea").value;
        if (await postNote({ action: "update", id, note: v })) openNotes();
      }
      if (act === "cancel") openNotes();
      if (act === "handover") {
        // A note still in the box is saved first, so it is not lost.
        if (ta.value.trim()) {
          const where = DECK ? { slide: h, title: title === "(title slide)" ? "" : title } : { section: title };
          if (!(await postNote({ action: "add", ...where, anchor: noteAnchor?.text, figure: noteAnchor?.figure, note: ta.value }))) return;
          ta.value = "";
          noteAnchor = null;
        }
        if (!notesData.batch) return say("No notes to hand over: add a note first (Add note or Ctrl+Enter)", "err");
        if (!confirm(`Hand over batch ${notesData.batch}? Its note files are marked closed for an LLM to act on; new notes start a new batch.`)) return;
        const r = await call("POST", "notes-handover", {});
        if (!r.ok) return say(r.error, "err");
        say(`Handed over ${r.files.length} file${r.files.length === 1 ? "" : "s"}: ${r.files.join(", ")}`, "ok");
        openNotes();
      }
    });
  }

  // Shift+click: note about this text. Runs before the other click handlers.
  document.addEventListener("mousedown", (e) => {
    if (e.shiftKey && inContent(e.target)) e.preventDefault(); // no text selection
  }, true);
  document.addEventListener("click", (e) => {
    if (!e.shiftKey || !inContent(e.target) || e.target.closest(".se-bar, .se-panel, .se-notes, .se-input")) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = e.target.closest("svg.se-svg");
    const label = e.target.closest("text, tspan");
    let anchor;
    if (svg && label) anchor = { text: label.closest("text").textContent.trim(), figure: svgPath.get(svg) };
    else if (svg || e.target.closest("img")) anchor = { text: "(figure)", figure: svg ? svgPath.get(svg) : relPath(e.target.closest("img")) || undefined };
    else {
      const el = e.target.closest("li, p, td, th, h1, h2, h3, figcaption, blockquote") || e.target;
      anchor = { text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 300) };
    }
    if (!DECK) anchor.section = sectionOf(e.target);
    openNotes(anchor);
  }, true);

  // ------------------------------------------------------------ wiring

  document.addEventListener("click", (e) => {
    if (!labelsOn || e.target.closest(".se-bar, .se-panel, .se-notes, .se-input, svg.se-svg")) return;
    if (e.target.closest("a, button, input, textarea, select, label, summary, iframe, canvas, .demo, [data-demo], .callout-header")) return;
    if (!inContent(e.target)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // selecting text, not clicking
    const text = e.target.closest("li, p, td, th, h1, h2, h3, h4, figcaption, blockquote, pre, dt, dd")?.textContent || e.target.textContent || "";
    openSource(text, DECK ? undefined : sectionOf(e.target));
  });

  // Step slides from the toolbar. An open source panel follows to the new
  // slide (after asking, if it has unsaved edits).
  function go(dir) {
    if (!DECK) return;
    const hadPanel = !!panel;
    if (hadPanel && !closePanel()) return;
    if (dir === "prev") Reveal.prev(); else Reveal.next();
    if (hadPanel) openSource("");
  }
  const num = bar.querySelector(".se-num");
  const showNum = () => { if (num) num.textContent = `${Reveal.getIndices().h + 1} / ${Reveal.getTotalSlides()}`; };

  bar.addEventListener("click", (e) => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "labels") setLabels(!labelsOn);
    if (act === "source") openSource();
    if (act === "notes") { if (noteBox) closeNotes(); else openNotes(null); }
    if (act === "prev" || act === "next") go(act);
  });

  if (!DECK) {
    try {
      const k = JSON.parse(sessionStorage.getItem("se-scroll") || "null");
      if (k && k.path === location.pathname) { sessionStorage.removeItem("se-scroll"); scrollTo(0, k.y); }
    } catch {}
    processSlide(MAIN);
    loadNotes();
    return;
  }
  const start = () => {
    processSlide(Reveal.getCurrentSlide());
    Reveal.on("slidechanged", (e) => {
      processSlide(e.currentSlide); showNum(); showNoteCount();
      if (noteBox) { noteAnchor = null; openNotes(); } // the note box follows the slide
    });
    loadNotes();
    showNum();
    // Images inside fragments or late layouts: try again after resize.
    Reveal.on("resize", () => processSlide(Reveal.getCurrentSlide()));
  };
  if (Reveal.isReady()) start(); else Reveal.on("ready", start);
})();
