import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { parseDbml } from "../src/model";

describe("parseDbml", () => {
  const model = parseDbml(readFileSync(__dirname + "/test.dbml", "utf8"));

  it("extracts tables with columns and source ranges", () => {
    const users = model.tables.find(t => t.name === "users")!;
    expect(users.columns[0]).toMatchObject({ name: "id", pk: true });
    expect(users.range.endLine).toBeGreaterThan(users.range.startLine);
  });

  it("extracts standalone and inline refs", () => {
    expect(model.refs).toHaveLength(6);
    expect(model.refs[0].from.relation).toBe("1");
  });

  it("resolves enum column types", () => {
    expect(model.enums[0]).toMatchObject({ id: "products_status", name: "products_status" });
    expect(model.enums[0].values.length).toBeGreaterThan(1);
    const status = model.tables.find(t => t.name === "products")!.columns.find(c => c.name === "status")!;
    expect(status.enumId).toBe("products_status");
    const plain = model.tables.find(t => t.name === "products")!.columns.find(c => c.name === "id")!;
    expect(plain.enumId).toBeUndefined();
  });

  it("throws on invalid DBML", () => {
    expect(() => parseDbml("Table {")).toThrow();
  });
});
