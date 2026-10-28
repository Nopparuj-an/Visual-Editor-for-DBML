import { describe, expect, it } from "vitest";
import { planAddNote, planAddRef, planInsertColumn, singular } from "../src/edits";
import { parseDbml } from "../src/model";

const src = `Table products {
  id int [pk]
  name varchar(255)
}

Table order_items {
  id int [pk]
  qty int
}
Ref: "orders"."id" < "order_items"."id"

Table orders {
  id bigint [pk]
}
`;
const lines = src.split("\n");
const model = parseDbml(src.replace('Ref: "orders"."id" < "order_items"."id"\n\n', "\n"));
const model2 = parseDbml(src);

const apply = (ls: string[], edits: { line: number; text: string }[]) => {
  const out = [...ls];
  for (const e of [...edits].sort((a, b) => b.line - a.line)) {
    out.splice(e.line, 0, ...e.text.split("\n"));
  }
  return out.join("\n");
};

describe("edits", () => {
  it("singularizes", () => {
    expect(["products", "categories", "boxes", "address", "user"].map(singular)).toEqual([
      "product", "category", "box", "address", "user"
    ]);
  });

  it("puts a new Ref under the child table, after existing Refs", () => {
    const out = apply(lines, planAddRef(lines, model2, { table: "products", column: "id" }, { table: "order_items", column: "qty" }));
    expect(out).toContain(
      `Ref: "orders"."id" < "order_items"."id"\nRef: "products"."id" < "order_items"."qty"\n`
    );
  });

  it("puts a Ref directly under a table without Refs", () => {
    const out = apply(lines, planAddRef(lines, model2, { table: "orders", column: "id" }, { table: "products", column: "name" }));
    expect(out).toContain(`  name varchar(255)\n}\nRef: "orders"."id" < "products"."name"\n\nTable order_items`);
  });

  it("inserts a column after the target plus a Ref", () => {
    const out = apply(lines, planInsertColumn(lines, model2, { table: "products", column: "id" }, { table: "order_items", after: "id" }));
    expect(out).toContain(`  id int [pk]\n  product_id int\n  qty int\n}`);
    expect(out).toContain(`Ref: "products"."id" < "order_items"."product_id"`);
  });

  it("avoids column name clashes", () => {
    const m = parseDbml("Table a {\n  id int\n}\nTable b {\n  a_id int\n}\n");
    const e = planInsertColumn("Table a {\n  id int\n}\nTable b {\n  a_id int\n}\n".split("\n"), m, { table: "a", column: "id" }, { table: "b", after: "a_id" });
    expect(e[0].text).toBe("  a_id_2 int");
  });

  it("adds a uniquely named note at the end", () => {
    const e = planAddNote(lines, model);
    expect(e.text).toContain("Note note_1 {");
    expect(e.line).toBe(lines.length - 1);
  });
});
