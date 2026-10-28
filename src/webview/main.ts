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
const GAP_X = 120;
const GAP_Y = 40;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

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

const tableHeight = (t: TableModel) => HEAD_H + t.columns.length * ROW_H;

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
lines.innerHTML = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0,1 L10,5 L0,9 z"/></marker></defs>`;
const linesLayer = s("g");
lines.appendChild(linesLayer);
world.append(lines);
viewport.append(world);
const msg = h("div");
msg.id = "msg";
const bar = h("div");
bar.id = "bar";
const zoomLabel = h("span");
for (const [label, fn] of [
  ["−", () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.25)],
  ["+", () => zoomAt(innerWidth / 2, innerHeight / 2, 1.25)],
  ["Fit", () => fit()]
] as const) {
  const b = h("button", undefined, label);
  b.onclick = fn;
  bar.append(b);
}
bar.insertBefore(zoomLabel, bar.children[1]);
root.append(viewport, msg, bar);

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
  for (const t of schema.tables) {
    const p = view().tables[t.id];
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + TABLE_W);
    y1 = Math.max(y1, p.y + tableHeight(t));
  }
  const pad = 40;
  const zoom = Math.min(1, (innerWidth - pad * 2) / (x1 - x0), (innerHeight - pad * 2) / (y1 - y0));
  const c = view().camera;
  c.zoom = Math.max(MIN_ZOOM, zoom);
  c.x = (innerWidth - (x1 - x0) * c.zoom) / 2 - x0 * c.zoom;
  c.y = (innerHeight - (y1 - y0) * c.zoom) / 2 - y0 * c.zoom;
  applyCamera();
  save();
}

viewport.addEventListener("wheel", e => {
  e.preventDefault();
  // Pinch / ctrl+wheel zooms smoothly; a plain wheel zooms in steps.
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
  zoomAt(e.clientX, e.clientY, factor);
}, { passive: false });

viewport.addEventListener("pointerdown", e => {
  if (e.target !== viewport && e.target !== world && e.target !== lines) {
    return;
  }
  select(null, null);
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
  for (const t of schema.tables) {
    const p = view().tables[t.id];
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
    head.onpointerdown = e => dragTable(e, t, el);
    el.append(head);
    for (const c of t.columns) {
      const row = h("div", "col");
      row.append(h("span", "name", c.name), h("span", "type", c.type));
      if (c.pk) {
        row.append(h("span", "badge", "PK"));
      }
      row.title = c.note ?? "";
      row.ondblclick = () => api.postMessage({ type: "reveal", line: c.range.startLine });
      row.onclick = () => select(null, { table: t.id, column: c.name });
      colEls.set(`${t.id}.${c.name}`, row);
      el.append(row);
    }
    tableEls.set(t.id, el);
    world.append(el);
  }
  drawRefs();
  applyCamera();
  applySelection();
}

function dragTable(e: PointerEvent, t: TableModel, el: HTMLElement) {
  if (e.button !== 0) {
    return;
  }
  const p = view().tables[t.id];
  const z = view().camera.zoom;
  const ox = e.clientX, oy = e.clientY, px = p.x, py = p.y;
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    p.x = px + (ev.clientX - ox) / z;
    p.y = py + (ev.clientY - oy) / z;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
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
  return { x: p.x + (side === 1 ? TABLE_W : 0), y: p.y + HEAD_H + i * ROW_H + ROW_H / 2, dir: side };
}

function drawRefs() {
  linesLayer.replaceChildren();
  for (const r of schema!.refs) {
    // Draw from the "many" side toward the "one" side so the arrowhead points at the referenced key.
    const [src, dst] = r.from.relation === "1" && r.to.relation === "*" ? [r.to, r.from] : [r.from, r.to];
    const sp = view().tables[src.table], dp = view().tables[dst.table];
    if (!sp || !dp) {
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
    const reach = Math.max(40, Math.abs(b.x - a.x) / 2);
    const d = `M${a.x},${a.y} C${a.x + a.dir * reach},${a.y} ${b.x + b.dir * reach},${b.y} ${b.x},${b.y}`;
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
