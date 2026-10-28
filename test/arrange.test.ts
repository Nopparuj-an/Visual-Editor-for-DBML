import { describe, expect, it } from "vitest";
import { arrange, ArrangeNode } from "../src/webview/arrange";

const node = (id: string, x = 0, y = 0, pinned = false): ArrangeNode => ({ id, w: 240, h: 100, x, y, pinned });
const overlap = (a: ArrangeNode, p: { x: number; y: number }, b: ArrangeNode, q: { x: number; y: number }) =>
  p.x < q.x + b.w && p.x + a.w > q.x && p.y < q.y + b.h && p.y + a.h > q.y;

describe("arrange", () => {
  const nodes = [node("child"), node("parent"), node("grand"), node("lonely")];
  const edges = [{ from: "child", to: "parent" }, { from: "parent", to: "grand" }];

  it("puts parents on the right when flowing right along the arrows", async () => {
    const p = await arrange(nodes, edges, "RIGHT");
    expect(p.get("child")!.x).toBeLessThan(p.get("parent")!.x);
    expect(p.get("parent")!.x).toBeLessThan(p.get("grand")!.x);
  });

  it("flips for right to left and top to bottom", async () => {
    const rl = await arrange(nodes, edges, "LEFT");
    expect(rl.get("child")!.x).toBeGreaterThan(rl.get("parent")!.x);
    const tb = await arrange(nodes, edges, "DOWN");
    expect(tb.get("child")!.y).toBeLessThan(tb.get("parent")!.y);
  });

  it("keeps pinned nodes where they are and avoids overlapping them", async () => {
    const pinned = [node("child", 1000, 500, true), ...nodes.slice(1)];
    const p = await arrange(pinned, edges, "RIGHT");
    expect(p.get("child")).toEqual({ x: 1000, y: 500 });
    for (const n of pinned.slice(1)) {
      expect(overlap(n, p.get(n.id)!, pinned[0], p.get("child")!)).toBe(false);
    }
  });

  it("grid places everything without overlap", async () => {
    const p = await arrange(nodes, [], "GRID");
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(overlap(nodes[i], p.get(nodes[i].id)!, nodes[j], p.get(nodes[j].id)!)).toBe(false);
      }
    }
  });
});
