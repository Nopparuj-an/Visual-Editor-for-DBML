import ELK from "elkjs/lib/elk.bundled.js";

export type Direction = "RIGHT" | "LEFT" | "DOWN" | "UP" | "GRID";

export interface ArrangeNode { id: string; w: number; h: number; x: number; y: number; pinned: boolean }
export interface ArrangeEdge { from: string; to: string }

const GAP = 40;

/**
 * New top-left position for every node. Pinned nodes keep their position; the rest are laid out
 * (layered, following the arrows) and shifted so they line up with where the pinned ones already are.
 */
export async function arrange(
  nodes: ArrangeNode[],
  edges: ArrangeEdge[],
  dir: Direction
): Promise<Map<string, { x: number; y: number }>> {
  const laid = dir === "GRID" ? grid(nodes) : await layered(nodes, edges, dir);
  const out = new Map<string, { x: number; y: number }>();

  const pinned = nodes.filter(n => n.pinned);
  if (pinned.length) {
    const dx = pinned.reduce((s, n) => s + n.x - laid.get(n.id)!.x, 0) / pinned.length;
    const dy = pinned.reduce((s, n) => s + n.y - laid.get(n.id)!.y, 0) / pinned.length;
    for (const n of nodes) {
      const p = laid.get(n.id)!;
      out.set(n.id, n.pinned ? { x: n.x, y: n.y } : { x: p.x + dx, y: p.y + dy });
    }
    pushClear(nodes, out);
  } else {
    laid.forEach((p, id) => out.set(id, p));
  }
  return out;
}

function grid(nodes: ArrangeNode[]) {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const out = new Map<string, { x: number; y: number }>();
  let x = 0, y = 0, rowH = 0;
  nodes.forEach((n, i) => {
    if (i && i % cols === 0) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    out.set(n.id, { x, y });
    x += n.w + 120;
    rowH = Math.max(rowH, n.h);
  });
  return out;
}

async function layered(nodes: ArrangeNode[], edges: ArrangeEdge[], dir: Exclude<Direction, "GRID">) {
  const ids = new Set(nodes.map(n => n.id));
  const g = await new ELK().layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": dir,
      "elk.spacing.nodeNode": "50",
      "elk.layered.spacing.nodeNodeBetweenLayers": "200",
      "elk.spacing.componentComponent": "80",
      "elk.separateConnectedComponents": "true"
    },
    children: nodes.map(n => ({ id: n.id, width: n.w, height: n.h })),
    edges: edges
      .filter(e => e.from !== e.to && ids.has(e.from) && ids.has(e.to))
      .map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] }))
  });
  return new Map((g.children ?? []).map(c => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
}

/** Move unpinned nodes down until they no longer overlap a pinned node or each other. */
function pushClear(nodes: ArrangeNode[], pos: Map<string, { x: number; y: number }>) {
  const placed = nodes.filter(n => n.pinned);
  const moving = nodes.filter(n => !n.pinned).sort((p, q) => pos.get(p.id)!.y - pos.get(q.id)!.y);
  for (const n of moving) {
    const p = pos.get(n.id)!;
    for (let again = true; again; ) {
      again = false;
      for (const o of placed) {
        const q = pos.get(o.id)!;
        if (p.x < q.x + o.w + GAP && p.x + n.w + GAP > q.x && p.y < q.y + o.h + GAP && p.y + n.h + GAP > q.y) {
          p.y = q.y + o.h + GAP;
          again = true;
        }
      }
    }
    placed.push(n);
  }
}
