import type { LayoutFile, ViewState } from "../layout";
import type { ColumnModel } from "../model";
import type { RefModel, SchemaModel, TableModel } from "../model";
import type { ToExtension, ToWebview } from "../messages";
import { arrange, Direction } from "./arrange";
import { Req, routeAll, routePoints } from "./router";
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
const PIN_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M9.5 1l5.5 5.5-1.4 1.4-.9-.9-2.8 2.8c.5 1.5.2 3-.8 4L6.4 10.7 2.7 14.4 1.6 13.3l3.7-3.7L2.1 6.4c1-1 2.5-1.3 4-.8l2.8-2.8-.9-.9L9.5 1z"/></svg>';
const STICKY_W = 200;
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
// Native `title` tooltips are slow and unreliable in webviews, so use our own.
const tipEl = h("div");
tipEl.id = "tip";
tipEl.hidden = true;
document.body.append(tipEl);

function tip(el: Element, text?: string) {
  (el as HTMLElement).dataset.tip = text ?? "";
  if (!text) {
    delete (el as HTMLElement).dataset.tip;
  }
}

function placeTip(e: MouseEvent) {
  const x = Math.min(e.clientX + 12, window.innerWidth - tipEl.offsetWidth - 8);
  const y = e.clientY + 18 + tipEl.offsetHeight > window.innerHeight ? e.clientY - tipEl.offsetHeight - 8 : e.clientY + 18;
  tipEl.style.cssText = `left:${Math.max(4, x)}px;top:${Math.max(4, y)}px;`;
}

document.addEventListener("mouseover", e => {
  const text = (e.target as Element).closest?.<HTMLElement>("[data-tip]")?.dataset.tip;
  tipEl.hidden = !text;
  if (text) {
    tipEl.textContent = text;
    placeTip(e);
  }
});
document.addEventListener("mousemove", e => !tipEl.hidden && placeTip(e));
for (const ev of ["pointerdown", "wheel", "keydown"]) {
  document.addEventListener(ev, () => (tipEl.hidden = true), true);
}

const tableHeight = (t: TableModel) => headHeight(t) + t.columns.length * ROW_H + PAD_B + BORDER * 2;

let schema: SchemaModel | null = null;
let layout: LayoutFile | null = null;
let selectedRef: string | null = null;
let selectedCol: { table: string; column: string } | null = null;

const view = (): ViewState => layout!.views[layout!.activeView];

const isNote = (id: string) => id.startsWith("note:");
const posOf = (id: string) => (isNote(id) ? view().notes[id.slice(5)] : view().tables[id]);

interface Item { id: string; x: number; y: number; w: number; h: number }

/** Everything draggable on the canvas that is currently visible: tables and sticky notes. */
function items(): Item[] {
  const out: Item[] = [];
  for (const t of schema?.tables ?? []) {
    const p = view().tables[t.id];
    if (p && !p.hidden) {
      out.push({ id: t.id, x: p.x, y: p.y, w: TABLE_W, h: tableHeight(t) });
    }
  }
  for (const n of schema?.notes ?? []) {
    const id = `note:${n.name}`;
    const p = view().notes[n.name], el = tableEls.get(id);
    if (p && el) {
      out.push({ id, x: p.x, y: p.y, w: el.offsetWidth, h: el.offsetHeight });
    }
  }
  return out;
}

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
for (const [label, title, fn] of [
  ["+ Group", "Add a container to group tables", () => addContainer()],
  ["+ Note", "Add a sticky note (inserts a Note block in the DBML)", () => {
    pendingNote = true;
    api.postMessage({ type: "addNote" });
  }]
] as const) {
  const b = h("button", undefined, label);
  tip(b, title);
  b.onclick = fn;
  bar.prepend(b);
}
side.append(search, viewsBox, tablesBox);
const marquee = h("div");
marquee.id = "marquee";
marquee.hidden = true;
const sideToggle = h("button", undefined, "☰");
sideToggle.id = "sideToggle";
tip(sideToggle, "Toggle side panel");
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
  const all = items();
  for (const c of view().containers) {
    all.push({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h });
  }
  if (!all.length) {
    return;
  }
  const x0 = Math.min(...all.map(i => i.x)), y0 = Math.min(...all.map(i => i.y));
  const x1 = Math.max(...all.map(i => i.x + i.w)), y1 = Math.max(...all.map(i => i.y + i.h));
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
    setSelected(items().filter(i => i.x < wr && i.x + i.w > wl && i.y < wb && i.y + i.h > wt).map(i => i.id));
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

let pendingNote = false;

function placeNewNotes() {
  const v = view();
  const fresh = schema!.notes.filter(n => !v.notes[n.name]);
  if (!fresh.length) {
    return;
  }
  const c = v.camera;
  let x = (viewport.clientWidth / 2 - c.x) / c.zoom - STICKY_W / 2;
  let y = (viewport.clientHeight / 2 - c.y) / c.zoom - 60;
  if (!pendingNote) {
    x = 0;
    y = Math.max(0, ...schema!.tables.map(t => v.tables[t.id].y + tableHeight(t))) + GAP_Y;
  }
  pendingNote = false;
  for (const n of fresh) {
    v.notes[n.name] = { x, y };
    x += STICKY_W + 40;
  }
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
  placeNewNotes();
  const fks = new Set<string>();
  for (const r of schema.refs) {
    for (const e of [r.from, r.to]) {
      if (e.relation === "*" || (r.from.relation === "1" && r.to.relation === "1" && e === r.from)) {
        e.columns.forEach(c => fks.add(`${e.table}.${c}`));
      }
    }
  }
  for (const id of [...selected]) {
    if (!schema.tables.some(t => t.id === id) && !schema.notes.some(n => `note:${n.name}` === id)) {
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
    tip(head, t.note);
    head.ondblclick = () => api.postMessage({ type: "reveal", line: t.range.startLine });
    head.onpointerdown = e => dragTable(e, t.id);
    el.append(head);
    const pin = h("button", "pin" + (p.pinned ? " on" : ""));
    pin.innerHTML = PIN_SVG;
    tip(pin, p.pinned ? "Pinned: arrange won't move it (click to unpin)" : "Pin so arrange won't move it");
    pin.onpointerdown = e => e.stopPropagation();
    pin.onclick = () => {
      p.pinned = p.pinned ? undefined : true;
      save();
      render();
    };
    el.append(pin);
    if (t.note) {
      const lines = t.note.trim().split(/\r?\n/).filter(l => l.trim());
      const note = h("div", "table-note", lines[0] + (lines.length > 1 ? " …" : ""));
      tip(note, t.note);
      el.append(note);
    }
    for (const c of t.columns) {
      const row = h("div", "col");
      const en = c.enumId ? schema.enums.find(e => e.id === c.enumId) : undefined;
      const enumInfo = en ? `enum ${en.name}\n${en.values.map(v => `• ${v.name}${v.note ? ` — ${v.note}` : ""}`).join("\n")}` : "";
      const type = h("span", "type", c.type);
      tip(type, enumInfo);
      row.append(h("span", "name", c.name), type);
      for (const [on, label, hint] of [
        [c.pk, "PK", "Primary key"],
        [fks.has(`${t.id}.${c.name}`), "FK", "Foreign key"],
        [c.notNull, "NN", "Not null"],
        [c.unique, "UQ", "Unique"],
        [c.increment, "AI", "Auto increment"],
        [!!enumInfo, "E", enumInfo]
      ] as const) {
        if (on) {
          const b = h("span", "badge", label);
          tip(b, hint);
          row.append(b);
        }
      }
      if (c.note) {
        const n = h("span", "badge note", "i");
        tip(n, c.note);
        row.append(n);
      }
      row.ondblclick = () => api.postMessage({ type: "reveal", line: c.range.startLine });
      row.onclick = () => !justDragged && select(null, { table: t.id, column: c.name });
      row.dataset.table = t.id;
      row.dataset.col = c.name;
      row.onpointerdown = e => startColDrag(e, t, c);
      colEls.set(`${t.id}.${c.name}`, row);
      el.append(row);
    }
    tableEls.set(t.id, el);
    world.append(el);
  }
  for (const n of schema.notes) {
    const el = h("div", "sticky");
    const p = view().notes[n.name];
    el.style.cssText = `left:${p.x}px;top:${p.y}px;width:${STICKY_W}px;`;
    el.append(h("div", "sticky-title", n.name), h("div", "sticky-body", n.content));
    tip(el, "Double-click to edit in code");
    el.ondblclick = () => api.postMessage({ type: "reveal", line: n.range.startLine });
    el.onpointerdown = e => dragTable(e, `note:${n.name}`);
    tableEls.set(`note:${n.name}`, el);
    world.append(el);
  }
  renderContainers();
  world.append(overlay);
  drawRefs();
  applyCamera();
  applySelection();
  applySearch();
  renderSide();
}

function dragTable(e: PointerEvent, id: string) {
  if (e.button !== 0) {
    return;
  }
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    applyTableSel();
    return;
  }
  if (!selected.has(id)) {
    setSelected([id]);
  }
  const z = view().camera.zoom;
  const ox = e.clientX, oy = e.clientY;
  const moving = [...selected].map(i => ({ id: i, p: posOf(i), x: posOf(i).x, y: posOf(i).y }));
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
    scheduleRefs();
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    cancelAnimationFrame(refFrame);
    drawRefs();
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

/**
 * A line is drawn as horizontal/vertical segments. Its shape is a list of "channels":
 * x of a vertical run, then y of a horizontal run, then x, ... always ending on an x (odd length).
 * `[mx]` is the plain H-V-H route; manual edits store a longer list in `view().lines`.
 */
interface Route { a: Anchor; b: Anchor; channels: number[]; manual: boolean; pts: Pt[] }
let routes = new Map<string, Route>();

const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** Orthogonal polyline with small rounded corners. */
function roundedPath(points: Pt[], radius = 6) {
  const p = points.filter((q, i) => i === 0 || q.x !== points[i - 1].x || q.y !== points[i - 1].y);
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const prev = p[i - 1], cur = p[i], next = p[i + 1];
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y), l2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const k1 = r / l1, k2 = r / l2;
    d += ` L${cur.x + (prev.x - cur.x) * k1},${cur.y + (prev.y - cur.y) * k1}`;
    d += ` Q${cur.x},${cur.y} ${cur.x + (next.x - cur.x) * k2},${cur.y + (next.y - cur.y) * k2}`;
  }
  return `${d} L${p[p.length - 1].x},${p[p.length - 1].y}`;
}

/** `settled` runs the slower conflict-resolving passes; skip it while something is being dragged. */
function drawRefs(settled = true) {
  linesLayer.replaceChildren();
  routes = new Map();
  const shown = items();
  const index = new Map(shown.map((i, n) => [i.id, n]));
  const pending: { ref: RefModel; src: RefModel["from"]; dst: RefModel["to"]; req: Req }[] = [];
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
    const manual = view().lines[r.id];
    pending.push({
      ref: r,
      src,
      dst,
      req: { id: r.id, a, b, srcObs: index.get(src.table)!, dstObs: index.get(dst.table)!, manual: manual?.length ? manual : undefined }
    });
  }
  const channels = routeAll(pending.map(p => p.req), shown, settled ? 3 : 0);
  for (const { ref: r, src, dst, req } of pending) {
    const { a, b } = req;
    const ch = channels.get(r.id)!;
    const pts = routePoints(a, b, ch);
    routes.set(r.id, { a, b, channels: ch, manual: !!req.manual, pts });
    const d = roundedPath(pts);
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

let refFrame = 0;
/** Redraw the lines at most once per frame while something is being dragged. */
function scheduleRefs() {
  cancelAnimationFrame(refFrame);
  refFrame = requestAnimationFrame(() => drawRefs(false));
}

function cardinality(at: Anchor, label: string) {
  const t = s("text", { x: at.x + at.dir * 7, y: at.y - 4, class: "card", "text-anchor": at.dir === 1 ? "start" : "end" });
  t.textContent = label;
  return t;
}

// --- Line editing -----------------------------------------------------------
function toWorld(ev: { clientX: number; clientY: number }): Pt {
  const r = viewport.getBoundingClientRect();
  const c = view().camera;
  return { x: (ev.clientX - r.left - c.x) / c.zoom, y: (ev.clientY - r.top - c.y) / c.zoom };
}

/** One handle per segment: drag a middle segment sideways, or pull the first/last run off the table to add a jog. */
function drawHandles() {
  handles.replaceChildren();
  const route = selectedRef ? routes.get(selectedRef) : undefined;
  if (!selectedRef || !route) {
    return;
  }
  const id = selectedRef;
  const { pts, channels, a, b } = route;
  for (let i = 0; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    const first = i === 0, last = i === pts.length - 2;
    const c = s("circle", { cx: m.x, cy: m.y, r: 5, class: first || last ? "handle ghost" : "handle" });
    c.addEventListener("pointerdown", e => {
      e.stopPropagation();
      if (first) {
        const w = toWorld(e);
        view().lines[id] = [a.x + a.dir * STUB, w.y, ...channels];
        trackSegment(id, 1);
      } else if (last) {
        const w = toWorld(e);
        view().lines[id] = [...channels, w.y, b.x + b.dir * STUB];
        trackSegment(id, channels.length);
      } else {
        view().lines[id] = [...channels];
        trackSegment(id, i - 1);
      }
    });
    handles.append(c);
  }
}

/** Drag channel `index` of a line: vertical runs (even) follow x, horizontal runs (odd) follow y. */
function trackSegment(id: string, index: number) {
  trackPointer(ev => {
    const route = routes.get(id)!;
    const ch = view().lines[id];
    const w = toWorld(ev);
    let v = index % 2 === 0 ? w.x : w.y;
    if (index === 0) {
      v = route.a.dir > 0 ? Math.max(v, route.a.x + 10) : Math.min(v, route.a.x - 10);
    }
    if (index === ch.length - 1) {
      v = route.b.dir > 0 ? Math.max(v, route.b.x + 10) : Math.min(v, route.b.x - 10);
    }
    ch[index] = v;
    drawRefs(false);
  });
  drawRefs();
}

/** Reset the manual route of a line. */
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
  selectedContainer = null;
  applyContainerSel();
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
    el.classList.toggle("faded", !!query && !isNote(id) && !found.has(id));
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
  if ((e.key === "Delete" || e.key === "Backspace") && !(e.target instanceof HTMLInputElement)) {
    if (selectedRef) {
      e.preventDefault();
      resetLine(selectedRef);
    } else if (selectedContainer) {
      e.preventDefault();
      view().containers = view().containers.filter(c => c.id !== selectedContainer);
      selectedContainer = null;
      save();
      renderContainers();
    }
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
  tip(b, title);
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
    tip(name, "Double-click to rename");
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

// --- Arrange ------------------------------------------------------------------
async function runArrange(dir: Direction) {
  const v = view();
  const shown = schema!.tables.filter(t => !v.tables[t.id].hidden);
  const ids = new Set(shown.map(t => t.id));
  const nodes = shown.map(t => ({
    id: t.id,
    w: TABLE_W,
    h: tableHeight(t),
    x: v.tables[t.id].x,
    y: v.tables[t.id].y,
    pinned: !!v.tables[t.id].pinned
  }));
  // Edges point many -> one, like the arrows, so referenced tables end up downstream.
  const edges = schema!.refs
    .filter(r => ids.has(r.from.table) && ids.has(r.to.table))
    .map(r => (r.from.relation === "1" && r.to.relation === "*" ? { from: r.to.table, to: r.from.table } : { from: r.from.table, to: r.to.table }));
  const pos = await arrange(nodes, edges, dir);
  for (const [id, p] of pos) {
    v.tables[id].x = p.x;
    v.tables[id].y = p.y;
  }
  for (const r of schema!.refs) {
    delete v.lines[r.id];
  }
  save();
  render();
  fit();
}

const menu = h("div");
menu.id = "menu";
menu.hidden = true;
// Names say where the parent (referenced) table ends up; ELK flows along the arrows, which point at parents.
for (const [label, dir] of [
  ["Parents on left", "LEFT"],
  ["Parents on right", "RIGHT"],
  ["Parents on top", "UP"],
  ["Parents on bottom", "DOWN"],
  ["Grid", "GRID"]
] as const) {
  const b = h("button", undefined, label);
  b.onclick = () => {
    menu.hidden = true;
    runArrange(dir);
  };
  menu.append(b);
}
root.append(menu);
const arrangeBtn = h("button", undefined, "Arrange ▴");
tip(arrangeBtn, "Auto-arrange the visible tables (pinned tables stay put; resets bent lines)");
arrangeBtn.onclick = e => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
};
bar.prepend(arrangeBtn);
document.addEventListener("pointerdown", e => {
  if (!menu.contains(e.target as Node)) {
    menu.hidden = true;
  }
});

// --- Containers ---------------------------------------------------------------
const containerEls: HTMLElement[] = [];
let selectedContainer: string | null = null;

function applyContainerSel() {
  view().containers.forEach((c, i) => containerEls[i]?.classList.toggle("sel", c.id === selectedContainer));
}

function selectContainer(id: string | null) {
  selectedContainer = id;
  if (id) {
    selectedRef = null;
    selectedCol = null;
    applySelection();
  }
  applyContainerSel();
}

function addContainer() {
  const c = view().camera;
  const w = 420, hh = 280;
  const id = `c-${Date.now().toString(36)}`;
  view().containers.push({
    id,
    title: "Group",
    w,
    h: hh,
    x: (viewport.clientWidth / 2 - c.x) / c.zoom - w / 2,
    y: (viewport.clientHeight / 2 - c.y) / c.zoom - hh / 2
  });
  save();
  renderContainers();
  selectContainer(id);
}

function renderContainers() {
  containerEls.forEach(e => e.remove());
  containerEls.length = 0;
  for (const c of view().containers) {
    const el = h("div", "container");
    const place = () => (el.style.cssText = `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;`);
    place();
    const title = h("div", "c-title", c.title);
    tip(title, "Drag to move with its tables · double-click to rename · Del to delete");
    title.ondblclick = () => {
      const input = h("input");
      input.value = c.title;
      input.onblur = () => {
        c.title = input.value.trim() || c.title;
        save();
        title.textContent = c.title;
        input.replaceWith(title);
      };
      input.onkeydown = ev => ev.key === "Enter" && input.blur();
      input.onpointerdown = ev => ev.stopPropagation();
      title.replaceWith(input);
      input.focus();
      input.select();
    };
    title.onpointerdown = e => {
      if (e.button !== 0) {
        return;
      }
      e.stopPropagation();
      selectContainer(c.id);
      // Tables and notes whose centre is inside the container travel with it.
      const inside = items().filter(i => i.x + i.w / 2 > c.x && i.x + i.w / 2 < c.x + c.w && i.y + i.h / 2 > c.y && i.y + i.h / 2 < c.y + c.h);
      const start = inside.map(i => ({ id: i.id, p: posOf(i.id), x: i.x, y: i.y }));
      const cx = c.x, cy = c.y, ox = e.clientX, oy = e.clientY, z = view().camera.zoom;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - ox) / z, dy = (ev.clientY - oy) / z;
        c.x = cx + dx;
        c.y = cy + dy;
        place();
        for (const m of start) {
          m.p.x = m.x + dx;
          m.p.y = m.y + dy;
          const t = tableEls.get(m.id)!;
          t.style.left = `${m.p.x}px`;
          t.style.top = `${m.p.y}px`;
        }
        scheduleRefs();
      };
      trackPointer(move);
    };
    const grip = h("div", "c-resize");
    grip.onpointerdown = e => {
      e.stopPropagation();
      const w0 = c.w, h0 = c.h, ox = e.clientX, oy = e.clientY, z = view().camera.zoom;
      trackPointer(ev => {
        c.w = Math.max(120, w0 + (ev.clientX - ox) / z);
        c.h = Math.max(80, h0 + (ev.clientY - oy) / z);
        place();
      });
    };
    el.append(title, grip);
    world.prepend(el);
    containerEls.push(el);
  }
  applyContainerSel();
}

/** Run `move` for every pointer move until release, then persist the layout. */
function trackPointer(move: (e: PointerEvent) => void) {
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    cancelAnimationFrame(refFrame);
    drawRefs();
    save();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// --- Link / insert mode ---------------------------------------------------------
let justDragged = false;
let dropEl: HTMLElement | null = null;

/** Drag a column onto another table's column to add a Ref, or onto a row's lower edge to add a new column + Ref below it. */
function startColDrag(e: PointerEvent, t: TableModel, c: ColumnModel) {
  if (e.button !== 0 || e.shiftKey || e.metaKey || e.ctrlKey) {
    return;
  }
  const sx = e.clientX, sy = e.clientY;
  let dragging = false;
  let drop: { el: HTMLElement; mode: "link" | "insert" } | null = null;
  const from = anchor(t.id, c.name, 1)!;
  const ghost = s("path", { class: "link-ghost" });

  const move = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) {
        return;
      }
      dragging = true;
      handles.append(ghost);
    }
    const w = toWorld(ev);
    ghost.setAttribute("d", `M${from.x},${from.y} L${from.x + STUB},${from.y} L${w.x},${w.y}`);
    dropEl?.classList.remove("drop-link", "drop-insert");
    dropEl = null;
    drop = null;
    const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>(".col");
    if (row && !(row.dataset.table === t.id && row.dataset.col === c.name)) {
      const r = row.getBoundingClientRect();
      const mode = (ev.clientY - r.top) / r.height > 0.7 ? "insert" : "link";
      row.classList.add(mode === "link" ? "drop-link" : "drop-insert");
      dropEl = row;
      drop = { el: row, mode };
    }
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    dropEl?.classList.remove("drop-link", "drop-insert");
    dropEl = null;
    ghost.remove();
    if (!dragging) {
      return;
    }
    justDragged = true;
    setTimeout(() => (justDragged = false), 0);
    if (drop) {
      const parent = { table: t.id, column: c.name };
      const child = { table: drop.el.dataset.table!, column: drop.el.dataset.col! };
      api.postMessage(
        drop.mode === "link"
          ? { type: "addRef", parent, child }
          : { type: "insertColumn", parent, child: { table: child.table, after: child.column } }
      );
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

// --- Messages ---------------------------------------------------------------
window.addEventListener("message", e => {
  const m = e.data as ToWebview;
  if (m.type !== "state") {
    return;
  }
  const first = !layout;
  layout = m.layout ?? layout;
  for (const v of Object.values(layout?.views ?? {})) {
    v.tables ??= {};
    v.lines ??= {};
    v.containers ??= [];
    for (const [k, line] of Object.entries(v.lines)) {
      if (!Array.isArray(line) || line.some(c => typeof c !== "number")) {
        delete v.lines[k];
      }
    }
    if (!v.notes || Array.isArray(v.notes)) {
      v.notes = {};
    }
  }
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
