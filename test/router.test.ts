import { describe, expect, it } from "vitest";
import { Req, Rect, routeAll, routePoints } from "../src/webview/router";

const W = 240;
const tbl = (x: number, y: number, h = 90): Rect => ({ x, y, w: W, h });

/** Does the polyline cross any rectangle (excluding the given indices at their own end)? */
function crosses(pts: { x: number; y: number }[], rects: Rect[], skip: number[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    rects.forEach((r, k) => {
      if (skip.includes(k) && (i === 0 || i === pts.length - 2)) {
        return;
      }
      const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
      if (x1 > r.x && x0 < r.x + r.w && y1 > r.y && y0 < r.y + r.h) {
        throw new Error(`segment ${i} crosses rect ${k}`);
      }
    });
  }
}

describe("routeAll", () => {
  it("routes a simple left-to-right line through the gap", () => {
    const rects = [tbl(0, 0), tbl(400, 100)];
    const a = { x: W, y: 30, dir: 1 as const }, b = { x: 400, y: 130, dir: -1 as const };
    const out = routeAll([{ id: "r", a, b, srcObs: 0, dstObs: 1 }], rects);
    expect(out.get("r")).toHaveLength(1);
    const x = out.get("r")![0];
    expect(x).toBeGreaterThan(W);
    expect(x).toBeLessThan(400);
  });

  it("goes around a table that sits in the way", () => {
    const rects = [tbl(0, 0), tbl(300, 0, 200), tbl(700, 0)];
    const a = { x: W, y: 30, dir: 1 as const }, b = { x: 700, y: 30, dir: -1 as const };
    const out = routeAll([{ id: "r", a, b, srcObs: 0, dstObs: 2 }], rects);
    crosses(routePoints(a, b, out.get("r")!), rects, [0, 2]);
    expect(out.get("r")!.length).toBeGreaterThan(1);
  });

  it("gives parallel lines different vertical lanes", () => {
    const rects = [tbl(0, 0, 300), tbl(500, 0, 300)];
    const reqs: Req[] = [0, 1, 2].map(i => ({
      id: `r${i}`,
      a: { x: W, y: 30 + i * 22, dir: 1 },
      b: { x: 500, y: 150 + i * 22, dir: -1 },
      srcObs: 0,
      dstObs: 1
    }));
    const out = routeAll(reqs, rects);
    const xs = reqs.map(r => out.get(r.id)![0]);
    expect(new Set(xs).size).toBe(3);
  });

  it("spreads lines that loop out the same side instead of stacking them", () => {
    const rects = [tbl(0, 300, 200), tbl(0, 0, 100)];
    const reqs: Req[] = [0, 1].map(i => ({
      id: `r${i}`,
      a: { x: W, y: 330 + i * 22, dir: 1 },
      b: { x: W, y: 30, dir: 1 },
      srcObs: 0,
      dstObs: 1
    }));
    const out = routeAll(reqs, rects);
    expect(out.get("r0")![0]).not.toBe(out.get("r1")![0]);
    for (const r of reqs) {
      expect(out.get(r.id)![0]).toBeGreaterThanOrEqual(W + 22);
    }
  });

  it("keeps manual routes untouched", () => {
    const rects = [tbl(0, 0), tbl(400, 0)];
    const out = routeAll([{ id: "r", a: { x: W, y: 30, dir: 1 }, b: { x: 400, y: 30, dir: -1 }, srcObs: 0, dstObs: 1, manual: [333] }], rects);
    expect(out.get("r")).toEqual([333]);
  });

  it("is fast enough to run while dragging (100 tables, 150 refs)", () => {
    const rects: Rect[] = [];
    for (let i = 0; i < 100; i++) {
      rects.push(tbl((i % 10) * 380, Math.floor(i / 10) * 200));
    }
    const reqs: Req[] = [];
    for (let i = 0; i < 150; i++) {
      const s = i % 100, d = (i * 7 + 13) % 100;
      if (s === d) {
        continue;
      }
      const toRight = rects[s].x < rects[d].x;
      reqs.push({
        id: `r${i}`,
        a: { x: rects[s].x + (toRight ? W : 0), y: rects[s].y + 40, dir: toRight ? 1 : -1 },
        b: { x: rects[d].x + (toRight ? 0 : W), y: rects[d].y + 40, dir: toRight ? -1 : 1 },
        srcObs: s,
        dstObs: d
      });
    }
    const t = performance.now();
    routeAll(reqs, rects);
    const ms = performance.now() - t;
    console.log(`routeAll: ${ms.toFixed(0)}ms`);
    expect(ms).toBeLessThan(1500);
  });
});
