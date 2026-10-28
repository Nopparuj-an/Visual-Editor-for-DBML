import type { LayoutFile, ViewState } from "../layout";
import type { RefModel, SchemaModel, TableModel } from "../model";
import type { ToExtension, ToWebview } from "../messages";
import { css } from "./styles";

declare function acquireVsCodeApi(): { postMessage(m: ToExtension): void };

const api = acquireVsCodeApi();
const SVG = "http://www.w3.org/2000/svg";
const TABLE_W = 240;
const HEAD_H = 28;
const ROW_H = 22;
const PAD_B = 2;
const BORDER = 1;
const STUB = 18;
const NOTE_H = 20;
const GAP_X = 120;
const GAP_Y = 40;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const SIDE_W = 240;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) {
    e.className = cls;
  }
  if (text !== undefined) {
    e.textContent = text;
  }
  return e;
}

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) {
    e.setAttribute(k, String(attrs[k]));
  }
  return e;
}

const headHeight = (t: TableModel) => HEAD_H + (t.note ? NOTE_H : 0);
const tableHeight = (t: TableModel) => headHeight(t) + t.columns.length * ROW_H + PAD_B + BORDER * 2;

let schema: SchemaModel | null = null;
let layout: LayoutFile | null = null;
let selectedRef: string | null = null;
let selectedCol: { table: string; column: string } | null = null;

const view = (): ViewState => layout!.views[layout!.activeView];

// --- DOM scaffold -----------------------------------------------------------
document.head.appendChild(document.createElement("style")).textContent = css;
const root = document.getElementById("root")!;
const viewport = h("div");
viewport.id = "viewport";
const world = h("div");
world.id = "world";
const lines = s("svg");
lines.id = "lines";
lines.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z"/></marker></defs>`;
const linesLayer = s("g");
lines.appendChild(linesLayer);
const overlay = s("svg");
overlay.id = "overlay";
const handles = s("g");
overlay.append(handles);
world.append(lines, overlay);
viewport.append(world);
const msg = h("div");
msg.id = "msg";
const bar = h("div");
bar.id = "bar";
const zoomLabel = h("span");
for (const [label, fn] of [
  ["−", () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.25)],
  ["+", () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.25)],
  ["Fit", () => fit()]
] as const) {
  const b = h("button", undefined, label);
  b.onclick = fn;
  bar.append(b);
}
bar.insertBefore(zoomLabel, bar.children[1]);
const side = h("div");
side.id = "side";
const search = h("input");
search.id = "search";
search.placeholder = "Search…";
const viewsBox = h("div", "section");
const tablesBox = h("div", "section");
side.append(search, viewsBox, tablesBox);
const marquee = h("div");
marquee.id = "marquee";
marquee.hidden = true;
const sideToggle = h("button", undefined, "☰");
sideToggle.id = "sideToggle";
sideToggle.title = "Toggle side panel";
function setSide(open: boolean) {
  side.style.display = open ? "" : "none";
  viewport.style.left = open ? `${SIDE_W}px` : "0";
  sideToggle.classList.toggle("open", open);
}
sideToggle.onclick = () => setSide(side.style.display === "none");
setSide(false);
viewport.append(marquee);
root.append(side, viewport, msg, bar, sideToggle);

// --- Camera -----------------------------------------------------------------
let saveTimer: number | undefined;
function save() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => layout && api.postMessage({ type: "saveLayout", layout }), 300);
}

function applyCamera() {
  const c = view().camera;
  world.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.zoom})`;
  zoomLabel.textContent = `${Math.round(c.zoom * 100)}%`;
}

function zoomAt(px: number, py: number, factor: number) {
  const c = view().camera;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom * factor));
  const k = zoom / c.zoom;
  c.x = px - (px - c.x) * k;
  c.y = py - (py - c.y) * k;
  c.zoom = zoom;
  applyCamera();
  save();
}

function fit() {
  if (!schema?.tables.length) {
    return;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const shown = schema.tables.filter(t => !view().tables[t.id].hidden);
  if (!shown.length) {
    return;
  }
  for (const t of shown) {
    const p = view().tables[t.id];
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + TABLE_W);
    y1 = Math.max(y1, p.y + tableHeight(t));
  }
  const pad = 40;
  const zoom = Math.min(1, (viewport.clientWidth - pad * 2) / (x1 - x0), (viewport.clientHeight - pad * 2) / (y1 - y0));
  const c = view().camera;
  c.zoom = Math.max(MIN_ZOOM, zoom);
  c.x = (viewport.clientWidth - (x1 - x0) * c.zoom) / 2 - x0 * c.zoom;
  c.y = (viewport.clientHeight - (y1 - y0) * c.zoom) / 2 - y0 * c.zoom;
  applyCamera();
  save();
}

viewport.addEventListener("wheel", e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Trackpad pinch arrives as ctrl+wheel; cmd/ctrl+wheel zooms with a mouse.
    const r = viewport.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
  } else {
    // Two-finger trackpad scroll pans.
    const c = view().camera;
    c.x -= e.deltaX;
    c.y -= e.deltaY;
    applyCamera();
    save();
  }
}, { passive: false });

viewport.addEventListener("pointerdown", e => {
  if (e.target !== viewport && e.target !== world && e.target !== lines) {
    return;
  }
  if (e.shiftKey) {
    return startMarquee(e);
  }
  select(null, null);
  setSelected([]);
  const c = view().camera;
  const sx = e.clientX - c.x, sy = e.clientY - c.y;
  viewport.setPointerCapture(e.pointerId);
  viewport.classList.add("panning");
  const move = (ev: PointerEvent) => {
    c.x = ev.clientX - sx;
    c.y = ev.clientY - sy;
    applyCamera();
  };
  const up = () => {
    viewport.classList.remove("panning");
    viewport.removeEventListener("pointermove", move);
    viewport.removeEventListener("pointerup", up);
    save();
  };
  viewport.addEventListener("pointermove", move);
  viewport.addEventListener("pointerup", up);
});

function startMarquee(e: PointerEvent) {
  const r = viewport.getBoundingClientRect();
  const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
  viewport.setPointerCapture(e.pointerId);
  marquee.hidden = false;
  const move = (ev: PointerEvent) => {
    const x1 = ev.clientX - r.left, y1 = ev.clientY - r.top;
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0), hh = Math.abs(y1 - y0);
    marquee.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${hh}px;`;
    const c = view().camera;
    const wl = (l - c.x) / c.zoom, wt = (t - c.y) / c.zoom, wr = (l + w - c.x) / c.zoom, wb = (t + hh - c.y) / c.zoom;
    setSelected(schema!.tables.filter(tb => {
      const p = view().tables[tb.id];
      return !p.hidden && p.x < wr && p.x + TABLE_W > wl && p.y < wb && p.y + tableHeight(tb) > wt;
    }).map(tb => tb.id));
  };
  const up = () => {
    marquee.hidden = true;
    viewport.removeEventListener("pointermove", move);
    viewport.removeEventListener("pointerup", up);
  };
  viewport.addEventListener("pointermove", move);
  viewport.addEventListener("pointerup", up);
}

// --- Layout -----------------------------------------------------------------
function placeNewTables() {
  const v = view();
  const fresh = schema!.tables.filter(t => !v.tables[t.id]);
  if (!fresh.length) {
    return;
  }
  const cols = Math.ceil(Math.sqrt(schema!.tables.length));
  let x = 0, y = 0, rowH = 0;
  fresh.forEach((t, i) => {
    if (i && i % cols === 0) {
      x = 0;
      y += rowH + GAP_Y;
      rowH = 0;
    }
    v.tables[t.id] = { x, y };
    x += TABLE_W + GAP_X;
    rowH = Math.max(rowH, tableHeight(t));
  });
  save();
}

// --- Rendering --------------------------------------------------------------
const tableEls = new Map<string, HTMLElement>();
const colEls = new Map<string, HTMLElement>();

function render() {
  for (const el of tableEls.values()) {
    el.remove();
  }
  tableEls.clear();
  colEls.clear();
  msg.textContent = "";
  if (!schema) {
    return;
  }
  placeNewTables();
  const fks = new Set<string>();
  for (const r of schema.refs) {
    for (const e of [r.from, r.to]) {
      if (e.relation === "*" || (r.from.relation === "1" && r.to.relation === "1" && e === r.from)) {
        e.columns.forEach(c => fks.add(`${e.table}.${c}`));
      }
    }
  }
  for (const id of [...selected]) {
    if (!schema.tables.some(t => t.id === id)) {
      selected.delete(id);
    }
  }
  for (const t of schema.tables) {
    const p = view().tables[t.id];
    if (p.hidden) {
      continue;
    }
    const el = h("div", "table");
    el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${TABLE_W}px;height:${tableHeight(t)}px;`;
    if (t.headerColor) {
      el.style.setProperty("--table-color", t.headerColor);
    }
    const head = h("div", "table-head");
    if (t.schema) {
      head.append(h("small", undefined, t.schema + "."));
    }
    head.append(t.name);
    head.title = t.note ?? "";
    head.ondblclick = () => api.postMessage({ type: "reveal", line: t.range.startLine });
    head.onpointerdown = e => dragTable(e, t);
    el.append(head);
    if (t.note) {
      const note = h("div", "table-note", t.note.replace(/\s+/g, " "));
      note.title = t.note;
      el.append(note);
    }
    for (const c of t.columns) {
      const row = h("div", "col");
      row.append(h("span", "name", c.name), h("span", "type", c.type));
      for (const [on, label, tip] of [
        [c.pk, "PK", "Primary key"],
        [fks.has(`${t.id}.${c.name}`), "FK", "Foreign key"],
        [c.unique, "UQ", "Unique"],
        [c.increment, "AI", "Auto increment"]
      ] as const) {
        if (on) {
          const b = h("span", "badge", label);
          b.title = tip;
          row.append(b);
        }
      }
      if (c.note) {
        const n = h("span", "badge note", "i");
        n.title = c.note;
        row.append(n);
      }
      row.ondblclick = () => api.postMessage({ type: "reveal", line: c.range.startLine });
      row.onclick = () => select(null, { table: t.id, column: c.name });
      colEls.set(`${t.id}.${c.name}`, row);
      el.append(row);
    }
    tableEls.set(t.id, el);
    world.append(el);
  }
  world.append(overlay);
  drawRefs();
  applyCamera();
  applySelection();
  applySearch();
  renderSide();
}

function dragTable(e: PointerEvent, t: TableModel) {
  if (e.button !== 0) {
    return;
  }
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    selected.has(t.id) ? selected.delete(t.id) : selected.add(t.id);
    applyTableSel();
    return;
  }
  if (!selected.has(t.id)) {
    setSelected([t.id]);
  }
  const z = view().camera.zoom;
  const ox = e.clientX, oy = e.clientY;
  const moving = [...selected].map(id => ({ id, p: view().tables[id], x: view().tables[id].x, y: view().tables[id].y }));
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    for (const m of moving) {
      m.p.x = m.x + (ev.clientX - ox) / z;
      m.p.y = m.y + (ev.clientY - oy) / z;
      const el = tableEls.get(m.id)!;
      el.style.left = `${m.p.x}px`;
      el.style.top = `${m.p.y}px`;
    }
    drawRefs();
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    save();
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
}

interface Anchor { x: number; y: number; dir: 1 | -1 }

function anchor(tableId: string, column: string, side: 1 | -1): Anchor | null {
  const t = schema!.tables.find(x => x.id === tableId);
  const p = view().tables[tableId];
  const i = t?.columns.findIndex(c => c.name === column) ?? -1;
  if (!t || !p || i < 0) {
    return null;
  }
  return { x: p.x + (side === 1 ? TABLE_W : 0), y: p.y + BORDER + headHeight(t) + i * ROW_H + ROW_H / 2, dir: side };
}

type Pt = { x: number; y: number };
/** Waypoints (plus the two stub ends) per ref id, as drawn; used for the bend handles. */
let geometry = new Map<string, Pt[]>();

const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** Polyline through the points with rounded corners (quadratic curves at each waypoint). */
function bentPath(a: Pt, b: Pt, p: Pt[]) {
  let d = `M${a.x},${a.y} L${p[0].x},${p[0].y}`;
  d += p.length > 2 ? ` L${mid(p[0], p[1]).x},${mid(p[0], p[1]).y}` : "";
  for (let i = 1; i < p.length - 1; i++) {
    const m = mid(p[i], p[i + 1]);
    d += ` Q${p[i].x},${p[i].y} ${m.x},${m.y}`;
  }
  return `${d} L${p[p.length - 1].x},${p[p.length - 1].y} L${b.x},${b.y}`;
}

function drawRefs() {
  linesLayer.replaceChildren();
  geometry = new Map();
  for (const r of schema!.refs) {
    // Draw from the "many" side toward the "one" side so the arrowhead points at the referenced key.
    const [src, dst] = r.from.relation === "1" && r.to.relation === "*" ? [r.to, r.from] : [r.from, r.to];
    const sp = view().tables[src.table], dp = view().tables[dst.table];
    if (!sp || !dp || sp.hidden || dp.hidden) {
      continue;
    }
    let ss: 1 | -1 = 1, ds: 1 | -1 = -1;
    if (sp.x > dp.x + TABLE_W) {
      ss = -1;
      ds = 1;
    } else if (sp.x + TABLE_W >= dp.x && dp.x + TABLE_W >= sp.x) {
      ds = 1; // overlapping columns of tables: loop out the right side
    }
    const a = anchor(src.table, src.columns[0], ss), b = anchor(dst.table, dst.columns[0], ds);
    if (!a || !b) {
      continue;
    }
    // Straight stubs leave/enter each table horizontally, so the curve never bends right at the arrowhead.
    const ax = a.x + a.dir * STUB, bx = b.x + b.dir * STUB;
    const wps = view().lines[r.id] ?? [];
    const reach = Math.max(40, Math.abs(bx - ax) / 2);
    const d = wps.length
      ? bentPath(a, b, [{ x: ax, y: a.y }, ...wps, { x: bx, y: b.y }])
      : `M${a.x},${a.y} L${ax},${a.y} C${ax + a.dir * reach},${a.y} ${bx + b.dir * reach},${b.y} ${bx},${b.y} L${b.x},${b.y}`;
    geometry.set(r.id, [{ x: ax, y: a.y }, ...wps, { x: bx, y: b.y }]);
    const g = s("g", { "data-ref": r.id });
    g.append(
      s("path", { d, class: "ref", "marker-end": "url(#arrow)" }),
      s("path", { d, class: "ref-hit" }),
      cardinality(a, src.relation === "*" ? "n" : "1"),
      cardinality(b, dst.relation === "*" ? "n" : "1")
    );
    g.querySelector(".ref-hit")!.addEventListener("click", () => select(r.id, null));
    g.querySelector(".ref-hit")!.addEventListener("dblclick", () => api.postMessage({ type: "reveal", line: r.range.startLine }));
    linesLayer.append(g);
  }
  applySelection();
}

function cardinality(at: Anchor, label: string) {
  const t = s("text", { x: at.x + at.dir * 10, y: at.y - 5, class: "card", "text-anchor": at.dir === 1 ? "start" : "end" });
  t.textContent = label;
  return t;
}

// --- Line bending ----------------------------------------------------------
function toWorld(ev: { clientX: number; clientY: number }): Pt {
  const r = viewport.getBoundingClientRect();
  const c = view().camera;
  return { x: (ev.clientX - r.left - c.x) / c.zoom, y: (ev.clientY - r.top - c.y) / c.zoom };
}

function drawHandles() {
  handles.replaceChildren();
  const pts = selectedRef ? geometry.get(selectedRef) : undefined;
  if (!selectedRef || !pts) {
    return;
  }
  const id = selectedRef;
  const wps = () => (view().lines[id] ??= []);
  // Ghost handles halfway along each segment: drag one to add a bend there.
  for (let i = 0; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    const c = s("circle", { cx: m.x, cy: m.y, r: 5, class: "handle ghost" });
    c.addEventListener("pointerdown", e => {
      e.stopPropagation();
      wps().splice(i, 0, toWorld(e));
      dragWaypoint(id, i);
      drawRefs();
    });
    handles.append(c);
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const c = s("circle", { cx: pts[i].x, cy: pts[i].y, r: 5, class: "handle" });
    c.addEventListener("pointerdown", e => {
      e.stopPropagation();
      dragWaypoint(id, i - 1);
    });
    c.addEventListener("dblclick", e => {
      e.stopPropagation();
      removeWaypoint(id, i - 1);
    });
    handles.append(c);
  }
}

function dragWaypoint(id: string, index: number) {
  const move = (ev: PointerEvent) => {
    view().lines[id][index] = toWorld(ev);
    drawRefs();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    save();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function removeWaypoint(id: string, index: number) {
  view().lines[id].splice(index, 1);
  if (!view().lines[id].length) {
    delete view().lines[id];
  }
  save();
  drawRefs();
}

/** Reset the manual bends of the selected line. */
function resetLine(id: string) {
  if (view().lines[id]) {
    delete view().lines[id];
    save();
    drawRefs();
  }
}

// --- Selection --------------------------------------------------------------
function select(ref: string | null, col: { table: string; column: string } | null) {
  selectedRef = ref;
  selectedCol = col;
  applySelection();
}

function touches(r: RefModel, col: { table: string; column: string }) {
  return [r.from, r.to].some(e => e.table === col.table && e.columns.includes(col.column));
}

function applySelection() {
  if (!schema) {
    return;
  }
  const hotCols = new Set<string>();
  const hotTables = new Set<string>();
  let any = false;
  for (const r of schema.refs) {
    const hot = r.id === selectedRef || (!!selectedCol && touches(r, selectedCol));
    const g = linesLayer.querySelector(`[data-ref="${CSS.escape(r.id)}"]`);
    g?.querySelector(".ref")?.classList.toggle("hot", hot);
    g?.querySelectorAll(".card").forEach(c => c.classList.toggle("hot", hot));
    if (hot) {
      any = true;
      for (const e of [r.from, r.to]) {
        hotTables.add(e.table);
        e.columns.forEach(c => hotCols.add(`${e.table}.${c}`));
      }
    }
  }
  linesLayer.classList.toggle("dim", any);
  for (const [k, el] of colEls) {
    el.classList.toggle("hot", hotCols.has(k) || (!!selectedCol && k === `${selectedCol.table}.${selectedCol.column}`));
  }
  for (const [k, el] of tableEls) {
    el.classList.toggle("hot", hotTables.has(k));
  }
  drawHandles();
}

// --- Table selection ----------------------------------------------------------
const selected = new Set<string>();

function setSelected(ids: string[]) {
  selected.clear();
  ids.forEach(id => selected.add(id));
  applyTableSel();
}

function applyTableSel() {
  for (const [id, el] of tableEls) {
    el.classList.toggle("sel", selected.has(id));
  }
  renderSide();
}

function centerOn(id: string) {
  const t = schema!.tables.find(x => x.id === id)!;
  const p = view().tables[id];
  const c = view().camera;
  c.x = viewport.clientWidth / 2 - (p.x + TABLE_W / 2) * c.zoom;
  c.y = viewport.clientHeight / 2 - (p.y + tableHeight(t) / 2) * c.zoom;
  applyCamera();
  save();
}

// --- Search -------------------------------------------------------------------
/** table id -> names of matching columns; empty map entry means only the table itself matched. */
let found = new Map<string, Set<string>>();
let query = "";
let jumpIndex = -1;

function applySearch() {
  found = new Map();
  if (query && schema) {
    for (const t of schema.tables) {
      const own = t.name.toLowerCase().includes(query) || (t.note ?? "").toLowerCase().includes(query);
      const cols = new Set(
        t.columns
          .filter(c => [c.name, c.type, c.note ?? ""].some(x => x.toLowerCase().includes(query)))
          .map(c => c.name)
      );
      if (own || cols.size) {
        found.set(t.id, cols);
      }
    }
  }
  for (const [id, el] of tableEls) {
    el.classList.toggle("faded", !!query && !found.has(id));
  }
  for (const [k, el] of colEls) {
    // table ids may contain a dot (schema.table), so match on the known table prefix
    const owner = [...found.keys()].find(id => k.startsWith(id + "."));
    el.classList.toggle("found", !!owner && found.get(owner)!.has(k.slice(owner.length + 1)));
  }
}

search.addEventListener("input", () => {
  query = search.value.trim().toLowerCase();
  jumpIndex = -1;
  applySearch();
  renderSide();
});
search.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  } else if (e.key === "Enter") {
    const hits = schema?.tables.filter(t => found.has(t.id) && !view().tables[t.id].hidden) ?? [];
    if (hits.length) {
      jumpIndex = (jumpIndex + (e.shiftKey ? hits.length - 1 : 1)) % hits.length;
      setSelected([hits[jumpIndex].id]);
      centerOn(hits[jumpIndex].id);
    }
  }
});
window.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") && selectedRef && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    resetLine(selectedRef);
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "f") {
    e.preventDefault();
    setSide(true);
    search.focus();
    search.select();
  }
});

// --- Side panel ---------------------------------------------------------------
function iconButton(label: string, title: string, fn: () => void) {
  const b = h("button", "icon", label);
  b.title = title;
  b.onclick = e => {
    e.stopPropagation();
    fn();
  };
  return b;
}

function switchView(key: string) {
  layout!.activeView = key;
  selected.clear();
  render();
  const v = view();
  if (v.camera.zoom === 1 && v.camera.x === 0 && v.camera.y === 0) {
    fit();
  }
  save();
}

function renderSide() {
  if (!layout || !schema) {
    return;
  }
  // Views
  viewsBox.replaceChildren();
  const head = h("div", "section-head");
  head.append(h("span", undefined, "Views"), iconButton("+", "New view (copy of current)", () => {
    const key = `view-${Date.now().toString(36)}`;
    const copy: ViewState = JSON.parse(JSON.stringify(view()));
    copy.name = `View ${Object.keys(layout!.views).length + 1}`;
    layout!.views[key] = copy;
    switchView(key);
  }));
  viewsBox.append(head);
  for (const [key, v] of Object.entries(layout.views)) {
    const row = h("div", "row" + (key === layout.activeView ? " active" : ""));
    const name = h("span", "grow", v.name);
    name.title = "Double-click to rename";
    name.ondblclick = () => {
      const input = h("input");
      input.value = v.name;
      const done = () => {
        v.name = input.value.trim() || v.name;
        save();
        renderSide();
      };
      input.onblur = done;
      input.onkeydown = ev => {
        if (ev.key === "Enter") {
          input.blur();
        } else if (ev.key === "Escape") {
          input.value = v.name;
          input.blur();
        }
      };
      name.replaceWith(input);
      input.focus();
      input.select();
    };
    row.onclick = () => key !== layout!.activeView && switchView(key);
    row.append(name);
    if (Object.keys(layout.views).length > 1) {
      row.append(iconButton("×", "Delete view", () => {
        delete layout!.views[key];
        if (key === layout!.activeView) {
          switchView(Object.keys(layout!.views)[0]);
        } else {
          save();
          renderSide();
        }
      }));
    }
    viewsBox.append(row);
  }

  // Tables
  tablesBox.replaceChildren();
  const th = h("div", "section-head");
  const setAll = (hidden: boolean) => {
    for (const t of schema!.tables) {
      view().tables[t.id].hidden = hidden || undefined;
    }
    save();
    render();
  };
  th.append(h("span", undefined, "Tables"), iconButton("◉", "Show all", () => setAll(false)), iconButton("○", "Hide all", () => setAll(true)));
  tablesBox.append(th);
  for (const t of schema.tables) {
    if (query && !found.has(t.id)) {
      continue;
    }
    const p = view().tables[t.id];
    const row = h("div", "row" + (p.hidden ? " off" : "") + (selected.has(t.id) ? " active" : ""));
    row.append(h("span", "grow", t.name));
    row.onclick = () => {
      if (!p.hidden) {
        setSelected([t.id]);
        centerOn(t.id);
      }
    };
    row.append(iconButton(p.hidden ? "○" : "◉", p.hidden ? "Show table" : "Hide table", () => {
      p.hidden = p.hidden ? undefined : true;
      selected.delete(t.id);
      save();
      render();
    }));
    tablesBox.append(row);
  }
}

// --- Messages ---------------------------------------------------------------
window.addEventListener("message", e => {
  const m = e.data as ToWebview;
  if (m.type !== "state") {
    return;
  }
  const first = !layout;
  layout = m.layout ?? layout;
  if (m.schema) {
    schema = m.schema;
  } else {
    msg.textContent = `Parse error: ${m.error}`;
    if (!schema) {
      return;
    }
  }
  if (!layout) {
    return;
  }
  render();
  if (m.schema) {
    msg.textContent = "";
  } else {
    msg.textContent = `Parse error: ${m.error}`;
  }
  const v = view();
  if (first && v.camera.zoom === 1 && v.camera.x === 0 && v.camera.y === 0) {
    fit();
  }
});

api.postMessage({ type: "ready" });
