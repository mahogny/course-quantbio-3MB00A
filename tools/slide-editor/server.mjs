#!/usr/bin/env node
// Slide editor: a small local web server for editing slide text in the browser.
//
// It serves the rendered site (docs/) and injects editor.js into every page.
// On any page rendered from a .qmd/.md (slides, exercises, quizzes, ...):
//   - click a label inside an SVG figure and change it (saved straight into
//     <unit>/figNN.svg and its docs/ copy, one string at a time),
//   - open the markdown source (the current slide on a deck, else the whole
//     file), edit it and save; the page is then re-rendered, and
//   - write notes about edits to make later (edit-notes/).
//
// Usage (from the repo root):
//   node tools/slide-editor/server.mjs [--port 8737] [--host 0.0.0.0]
// The access token is taken from $SLIDE_EDIT_TOKEN or generated at start, and
// printed as part of the URL. The first request with ?token=... sets a cookie,
// so links within the site keep working.
//
// Only these files can be written:
//   <unit>/*.qmd, <unit>/*.md and top-level *.qmd/*.md pages
//   <unit>/*.svg  that are not produced by an R script in the same folder
//   edit-notes/*.json
// No dependencies beyond Node >= 18.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DOCS = path.join(REPO, "docs");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const PORT = Number(opt("port", process.env.SLIDE_EDIT_PORT || 8737));
const HOST = opt("host", "0.0.0.0");
const TOKEN = process.env.SLIDE_EDIT_TOKEN || crypto.randomBytes(12).toString("hex");
const QUARTO = process.env.QUARTO || "quarto";

// Top-level folders that are never units.
const NOT_UNITS = new Set(["docs", "node_modules", "demos", "plan", "tools", "edit-notes",
  "unused-figures", "site_libs", ".git", ".quarto"]);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};

// ---------------------------------------------------------------- helpers

function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(data);
}
const fail = (res, code, msg) => send(res, code, { ok: false, error: msg });

function readBody(req, limit = 2 << 20) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("body too large")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("bad JSON")); }
    });
    req.on("error", reject);
  });
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Atomic write: temp file in the same folder, then rename.
function writeFileAtomic(file, text) {
  const tmp = file + ".slide-editor-tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- permissions

function unitOf(rel) {
  const parts = rel.split("/");
  if (parts.length !== 2 || NOT_UNITS.has(parts[0]) || parts[0].startsWith(".")) return null;
  return parts[0];
}

// Is this SVG written by an R script in its folder? Then edits would be lost.
function svgGenerator(rel) {
  const [unit, name] = rel.split("/");
  const dir = path.join(REPO, unit);
  for (const f of fs.readdirSync(dir)) {
    if (!/\.R$/i.test(f)) continue;
    if (fs.readFileSync(path.join(dir, f), "utf8").includes(name)) return `${unit}/${f}`;
  }
  return null;
}

function checkSvg(rel) {
  if (typeof rel !== "string" || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.svg$/.test(rel))
    return { editable: false, reason: "not a figure in a unit folder" };
  if (!unitOf(rel)) return { editable: false, reason: "not in a unit folder" };
  if (!fs.existsSync(path.join(REPO, rel))) return { editable: false, reason: "no source file" };
  const gen = svgGenerator(rel);
  if (gen) return { editable: false, reason: `generated by ${gen}` };
  return { editable: true };
}

// A page source: <unit>/<name>.qmd|md or a top-level <name>.qmd|md.
function checkSource(rel) {
  if (typeof rel !== "string" || !/^(?:[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+\.(?:qmd|md)$/.test(rel)) return false;
  if (rel.includes("/") && !unitOf(rel)) return false;
  return fs.existsSync(path.join(REPO, rel));
}

// The source of a rendered page: /pca/exercise.html -> pca/exercise.qmd.
function sourceOfPage(urlPath) {
  let p = urlPath.replace(/^\/+/, "");
  if (p === "" || p.endsWith("/")) p += "index.html";
  const m = p.match(/^(.*)\.html$/);
  if (!m) return null;
  for (const ext of [".qmd", ".md"]) if (checkSource(m[1] + ext)) return m[1] + ext;
  return null;
}

// ---------------------------------------------------------------- SVG text runs
//
// An editable "run" is a piece of character data inside a <text> element,
// between two tags, that is not only whitespace. The browser sees exactly the
// same runs as DOM text nodes, in the same order, so (index, old text) pins
// down one string in the file. Replacing only that slice keeps the rest of
// the file byte-for-byte unchanged.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decodeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(n);
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const encodeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgRuns(src) {
  const runs = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/g;
  let depth = 0, el = null, m;
  while ((m = re.exec(src))) {
    const tok = m[0];
    if (tok[0] === "<") {
      if (/^<text[\s>]/.test(tok) && !tok.endsWith("/>")) {
        if (depth++ === 0) el = { start: m.index, end: -1, runs: 0 };
      } else if (/^<\/text\s*>/.test(tok)) {
        depth = Math.max(0, depth - 1);
        if (depth === 0 && el) el.end = m.index + tok.length;
      }
    } else if (depth > 0) {
      const text = decodeXml(tok);
      if (text.trim()) { runs.push({ start: m.index, end: m.index + tok.length, text, el }); el.runs++; }
    }
  }
  return runs;
}

function writeSvg(rel, out) {
  writeFileAtomic(path.join(REPO, rel), out);
  const copy = path.join(DOCS, rel);
  if (fs.existsSync(path.dirname(copy))) writeFileAtomic(copy, out);
}

// An empty new text deletes: the whole <text> element when this is its only
// label (with its line, if it stands alone on one), otherwise just this piece
// of a mixed label such as "P(0.14 ≤ <tspan>p</tspan> ≤ 0.52)".
function editSvgText(rel, index, oldText, newText) {
  const src = fs.readFileSync(path.join(REPO, rel), "utf8");
  const runs = svgRuns(src);
  const run = runs[index];
  if (!run) return { code: 409, error: `label ${index} not found (file has ${runs.length})` };
  if (run.text !== oldText)
    return { code: 409, error: "the file changed since the page was loaded; reload the page" };
  if (newText.trim()) {
    writeSvg(rel, src.slice(0, run.start) + encodeXml(newText) + src.slice(run.end));
    return { code: 200, action: "changed" };
  }
  if (run.el.runs === 1 && run.el.end > 0) {
    let a = run.el.start, b = run.el.end;
    const ls = src.lastIndexOf("\n", a - 1) + 1;
    let le = src.indexOf("\n", b);
    if (le < 0) le = src.length;
    if (!src.slice(ls, a).trim() && !src.slice(b, le).trim()) { a = ls; b = Math.min(le + 1, src.length); }
    writeSvg(rel, src.slice(0, a) + src.slice(b));
    return { code: 200, action: "removed element" };
  }
  writeSvg(rel, src.slice(0, run.start) + src.slice(run.end));
  return { code: 200, action: "removed text" };
}

// ---------------------------------------------------------------- slide sources
//
// Slide h (reveal's horizontal index; 0 is the title slide) is the h-th
// heading of level 1 or 2 outside the YAML header and code fences. The slide's
// source runs from that heading to the line before the next one.

function slideChunks(src) {
  const lines = src.split("\n");
  const heads = [];
  let i = 0, fence = null;
  if (lines[0] === "---") {
    i = 1;
    while (i < lines.length && lines[i] !== "---") i++;
    i++;
  }
  for (; i < lines.length; i++) {
    const l = lines[i];
    const f = l.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (l.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (!fence && /^#{1,2} /.test(l)) heads.push(i);
  }
  return { lines, chunks: heads.map((s, k) => ({ start: s, end: k + 1 < heads.length ? heads[k + 1] : lines.length })) };
}

const norm = (s) => s.replace(/\{[^}]*\}\s*$/, "").replace(/^#+\s*/, "")
  .replace(/[*_`$\\]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function findSlide(rel, h, title) {
  const src = fs.readFileSync(path.join(REPO, rel), "utf8");
  const { lines, chunks } = slideChunks(src);
  let k = h - 1, warning = null;
  const t = norm(title || "");
  const matches = (c) => c && norm(lines[c.start]) === t;
  if (!matches(chunks[k]) && t) {
    const hits = chunks.map((c, j) => (matches(c) ? j : -1)).filter((j) => j >= 0);
    if (hits.length === 1) k = hits[0];
    else warning = "the slide title did not match the source exactly; check this is the right slide";
  }
  const c = chunks[k];
  if (!c) return null;
  return { k, start: c.start, end: c.end, text: lines.slice(c.start, c.end).join("\n"), warning, lines };
}

// ---------------------------------------------------------------- edit notes
//
// Notes about what to change on a slide, for an LLM (or a person) to act on
// later. One JSON file per page per batch: edit-notes/<batch>_<unit>_<page>.json,
// where <batch> is the time the batch was started. "Hand over" closes the
// open batch (status "closed" in its files); the next note starts a new one.
// Whoever acts on a closed file deletes it when done. See edit-notes/README.md.

const NOTES = path.join(REPO, "edit-notes");
const notesState = { batch: null };

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

function noteFiles() {
  if (!fs.existsSync(NOTES)) return [];
  return fs.readdirSync(NOTES).filter((f) => /^\d{4}-\d\d-\d\dT\d{6}_[A-Za-z0-9_-]+\.json$/.test(f)).sort()
    .map((f) => {
      try { return { file: f, data: JSON.parse(fs.readFileSync(path.join(NOTES, f), "utf8")) }; }
      catch { return null; }
    }).filter(Boolean);
}

// The open batch: the one this server started, else the newest open one on
// disk (so a restart continues it), else none until the next note.
function openBatch() {
  if (notesState.batch) return notesState.batch;
  const open = noteFiles().filter((f) => f.data.status === "open").map((f) => f.data.batch).sort();
  return (notesState.batch = open.length ? open[open.length - 1] : null);
}

function notesFor(page) {
  const batch = openBatch();
  return noteFiles().filter((f) => f.data.page === page)
    .map((f) => ({ file: `edit-notes/${f.file}`, batch: f.data.batch, status: f.data.status,
      open: f.data.status === "open" && f.data.batch === batch, notes: f.data.notes || [] }));
}

function saveNote(b) {
  let batch = openBatch();
  if (!batch) {
    if (b.action !== "add") return { code: 409, error: "no open batch" };
    batch = notesState.batch = stamp();
  }
  fs.mkdirSync(NOTES, { recursive: true });
  const file = path.join(NOTES, `${batch}_${b.page.replace(/\.(q?md)$/, "").replace("/", "_")}.json`);
  const now = new Date().toISOString();
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { page: b.page, batch, status: "open", created: now, updated: now, notes: [] };
  if (data.status !== "open") return { code: 409, error: "this batch was handed over; reload the page" };
  if (b.action === "add") {
    if (!String(b.note || "").trim()) return { code: 400, error: "empty note" };
    const n = { id: crypto.randomBytes(4).toString("hex") };
    if (b.slide !== undefined && b.slide !== null) {
      const s = findSlide(b.page, Number(b.slide), b.title) || {};
      Object.assign(n, { slide: Number(b.slide), title: b.title || "",
        source: s.start !== undefined ? `${b.page}:${s.start + 1}` : b.page });
    } else {
      const line = headingLine(b.page, b.section);
      Object.assign(n, { section: b.section || "", source: line ? `${b.page}:${line}` : b.page });
    }
    if (b.anchor) n.anchor = String(b.anchor).slice(0, 500);
    if (b.figure) n.figure = String(b.figure);
    n.note = String(b.note).trim();
    n.created = now;
    data.notes.push(n);
  } else {
    const i = data.notes.findIndex((n) => n.id === b.id);
    if (i < 0) return { code: 404, error: "note not found (already handled?)" };
    if (b.action === "delete") data.notes.splice(i, 1);
    else if (b.action === "update") {
      if (!String(b.note || "").trim()) return { code: 400, error: "empty note" };
      data.notes[i].note = String(b.note).trim();
      data.notes[i].edited = now;
    } else return { code: 400, error: "unknown action" };
  }
  data.updated = now;
  if (data.notes.length) writeFileAtomic(file, JSON.stringify(data, null, 2) + "\n");
  else if (fs.existsSync(file)) fs.unlinkSync(file);
  return { code: 200, batch };
}

// Line (1-based) of the heading whose text matches `title`, if any.
function headingLine(rel, title) {
  if (!title) return 0;
  const t = norm(title);
  const lines = fs.readFileSync(path.join(REPO, rel), "utf8").split("\n");
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1]; else if (lines[i].trim().startsWith(fence)) fence = null; continue; }
    if (!fence && /^#{1,6} /.test(lines[i]) && norm(lines[i]) === t) return i + 1;
  }
  return 0;
}

function handOver() {
  const batch = openBatch();
  if (!batch) return { files: [] };
  const files = [];
  for (const f of noteFiles()) {
    if (f.data.batch !== batch || f.data.status !== "open") continue;
    f.data.status = "closed";
    f.data.closed = new Date().toISOString();
    writeFileAtomic(path.join(NOTES, f.file), JSON.stringify(f.data, null, 2) + "\n");
    files.push(`edit-notes/${f.file}`);
  }
  notesState.batch = null;
  return { files };
}

// ---------------------------------------------------------------- rendering

const render = { state: "idle", target: null, log: "", again: null, started: 0, finished: 0 };

function startRender(rel) {
  if (render.state === "running") { render.again = rel; return; }
  render.state = "running";
  render.target = rel;
  render.log = "";
  render.started = Date.now();
  const p = spawn(QUARTO, ["render", rel], { cwd: REPO, env: process.env });
  const add = (d) => { render.log = (render.log + d.toString()).slice(-20000); };
  p.stdout.on("data", add);
  p.stderr.on("data", add);
  p.on("error", (e) => { add(String(e)); finish(1); });
  p.on("close", (code) => finish(code));
  function finish(code) {
    if (render.state !== "running") return;
    render.state = code === 0 ? "done" : "error";
    render.finished = Date.now();
    console.log(`[render] ${rel}: ${render.state} (${((render.finished - render.started) / 1000).toFixed(1)} s)`);
    if (render.again) { const r = render.again; render.again = null; startRender(r); }
  }
}

// ---------------------------------------------------------------- API

async function api(req, res, url) {
  const route = url.pathname.slice("/__editor/".length);

  if (route === "editor.js" || route === "editor.css") {
    const f = path.join(HERE, route);
    return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)]);
  }

  if (route === "log" && req.method === "POST") {
    const b = await readBody(req, 20000).catch(() => ({}));
    console.log(`[browser] ${b.url}: ${b.msg}\n          ${b.ua}`);
    return send(res, 204, "");
  }

  if (route === "svg-info" && req.method === "GET") {
    const rel = url.searchParams.get("path");
    const chk = checkSvg(rel);
    // The labels let the page check that it sees the same runs as we do.
    console.log(`[page] ${rel}: ${chk.editable ? "editable" : chk.reason}`);
    if (chk.editable) chk.labels = svgRuns(fs.readFileSync(path.join(REPO, rel), "utf8")).map((r) => r.text);
    return send(res, 200, chk);
  }

  if (route === "svg-text" && req.method === "POST") {
    const b = await readBody(req);
    const chk = checkSvg(b.path);
    if (!chk.editable) return fail(res, 403, chk.reason);
    if (!Number.isInteger(b.index) || typeof b.old !== "string" || typeof b.new !== "string")
      return fail(res, 400, "bad request");
    const r = editSvgText(b.path, b.index, b.old, b.new);
    if (r.code !== 200) return fail(res, r.code, r.error);
    console.log(`[svg] ${b.path} #${b.index}: ${JSON.stringify(b.old)} -> ${r.action === "changed" ? JSON.stringify(b.new) : r.action}`);
    return send(res, 200, { ok: true, action: r.action });
  }

  if (route === "page" && req.method === "GET") {
    const src = sourceOfPage(url.searchParams.get("url") || "");
    return send(res, 200, src ? { ok: true, source: src } : { ok: false });
  }

  if (route === "source" && req.method === "GET") {
    const rel = url.searchParams.get("path");
    if (!checkSource(rel)) return fail(res, 403, "not an editable page source");
    return send(res, 200, { ok: true, text: fs.readFileSync(path.join(REPO, rel), "utf8") });
  }

  if (route === "source" && req.method === "POST") {
    const b = await readBody(req);
    if (!checkSource(b.path)) return fail(res, 403, "not an editable page source");
    if (typeof b.old !== "string" || typeof b.new !== "string") return fail(res, 400, "bad request");
    const file = path.join(REPO, b.path);
    if (fs.readFileSync(file, "utf8") !== b.old)
      return fail(res, 409, "the file changed since you opened it; reopen the source");
    writeFileAtomic(file, b.new.replace(/\r\n/g, "\n"));
    console.log(`[src] ${b.path} saved`);
    startRender(b.path);
    return send(res, 200, { ok: true });
  }

  if (route === "slide" && req.method === "GET") {
    const rel = url.searchParams.get("path");
    if (!checkSource(rel)) return fail(res, 403, "not an editable page source");
    const s = findSlide(rel, Number(url.searchParams.get("h")), url.searchParams.get("title"));
    if (!s) return fail(res, 404, "slide not found in the source");
    return send(res, 200, { ok: true, text: s.text, line: s.start + 1, warning: s.warning });
  }

  if (route === "slide" && req.method === "POST") {
    const b = await readBody(req);
    if (!checkSource(b.path)) return fail(res, 403, "not an editable page source");
    if (typeof b.old !== "string" || typeof b.new !== "string") return fail(res, 400, "bad request");
    const s = findSlide(b.path, Number(b.h), b.title);
    if (!s || s.text !== b.old)
      return fail(res, 409, "the source changed since you opened it; reopen the slide source");
    const text = b.new.replace(/\r\n/g, "\n");
    const out = [...s.lines.slice(0, s.start), text, ...s.lines.slice(s.end)].join("\n");
    writeFileAtomic(path.join(REPO, b.path), out);
    console.log(`[qmd] ${b.path}: slide ${b.h} (line ${s.start + 1}) saved`);
    startRender(b.path);
    return send(res, 200, { ok: true });
  }

  if (route === "notes" && req.method === "GET") {
    const page = url.searchParams.get("page");
    if (!checkSource(page)) return fail(res, 403, "not an editable page source");
    return send(res, 200, { ok: true, batch: openBatch(), files: notesFor(page) });
  }

  if (route === "notes" && req.method === "POST") {
    const b = await readBody(req);
    if (!checkSource(b.page)) {
      console.log(`[note] rejected for ${JSON.stringify(b.page)}: not an editable page source`);
      return fail(res, 403, "not an editable page source");
    }
    const r = saveNote(b);
    if (r.code !== 200) {
      console.log(`[note] ${b.page}: ${b.action} rejected: ${r.error}`);
      return fail(res, r.code, r.error);
    }
    console.log(`[note] ${b.page} ${b.slide ?? b.section ?? ""}: ${b.action} (batch ${r.batch})`);
    return send(res, 200, { ok: true, batch: r.batch });
  }

  if (route === "notes-handover" && req.method === "POST") {
    const r = handOver();
    console.log(`[note] handed over: ${r.files.join(", ") || "nothing"}`);
    return send(res, 200, { ok: true, files: r.files });
  }

  if (route === "render-status" && req.method === "GET") {
    return send(res, 200, { state: render.state, target: render.target, queued: !!render.again,
      finished: render.finished, log: render.state === "error" ? render.log.slice(-4000) : "" });
  }

  return fail(res, 404, "unknown editor route");
}

// ---------------------------------------------------------------- static files

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return fail(res, 400, "bad path"); }
  let file = path.normalize(path.join(DOCS, rel));
  if (file !== DOCS && !file.startsWith(DOCS + path.sep)) return fail(res, 403, "outside the site");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) return send(res, 404, "Not found", "text/plain; charset=utf-8");
  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file);
  if (ext === ".html") {
    const tag = `<script src="/__editor/editor.js" defer></script>`;
    const html = body.toString("utf8");
    body = html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, tag + "</body>") : html + tag;
  }
  send(res, 200, body, MIME[ext] || "application/octet-stream");
}

// ---------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = url.searchParams.get("token");
  const authed = (q && safeEqual(q, TOKEN)) || safeEqual(cookies(req).se_token || "", TOKEN);
  if (!authed) return send(res, 403, "Forbidden: add ?token=... to the URL\n", "text/plain; charset=utf-8");
  const extra = q ? { "Set-Cookie": `se_token=${TOKEN}; Path=/; HttpOnly; SameSite=Strict` } : {};
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = (code, headers) => origWriteHead(code, { ...headers, ...extra });
  try {
    if (url.pathname.startsWith("/__editor/")) await api(req, res, url);
    else if (req.method === "GET" || req.method === "HEAD") serveStatic(req, res, url);
    else fail(res, 405, "method not allowed");
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, String(e.message || e));
  }
});

server.listen(PORT, HOST, () => {
  const host = os.hostname();
  console.log(`Slide editor serving ${DOCS}`);
  console.log(`Writes allowed: page sources (.qmd/.md), hand-made <unit>/*.svg and edit-notes/ under ${REPO}`);
  console.log(`\n  Sandbox: http://${host}:${PORT}/editor-sandbox/lec.html?token=${TOKEN}`);
  console.log(`  Site:    http://${host}:${PORT}/?token=${TOKEN}\n`);
});
