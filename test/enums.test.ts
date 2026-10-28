import { describe, expect, it } from "vitest";
import { parseDbml } from "../src/model";

const src = `
Enum status { active\n inactive [note: 'gone'] }
Enum auth.role { admin\n user }
Enum "order state" { open\n closed }

Table a {
  id int [pk]
  plain status
  qualified_public public.status
  quoted "public"."status"
  schema_enum auth.role
  as_array status[]
  spaced "order state"
  not_enum varchar(20)
}
Table auth.b {
  id int
  local_role role
}
Enum auth.role2 { x }
`;

describe("enum columns", () => {
  const model = parseDbml(src);
  const col = (t: string, c: string) => model.tables.find(x => x.id === t)!.columns.find(x => x.name === c)!;

  it("finds the enums", () => {
    expect(model.enums.map(e => e.id).sort()).toEqual(["auth.role", "auth.role2", "order state", "status"]);
  });

  it.each([
    ["a", "plain", "status"],
    ["a", "qualified_public", "status"],
    ["a", "quoted", "status"],
    ["a", "schema_enum", "auth.role"],
    ["a", "as_array", "status"],
    ["a", "spaced", "order state"],
    ["auth.b", "local_role", "auth.role"]
  ])("%s.%s -> %s", (t, c, id) => {
    expect(col(t, c).enumId).toBe(id);
  });

  it("leaves non-enum columns alone", () => {
    expect(col("a", "not_enum").enumId).toBeUndefined();
    expect(col("a", "id").enumId).toBeUndefined();
  });
});
