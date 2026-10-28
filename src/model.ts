import { Parser } from "@dbml/core";

export interface SourceRange {
  startLine: number;
  endLine: number;
}

export interface ColumnModel {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  increment: boolean;
  /** Id of the enum this column's type refers to, if any. */
  enumId?: string;
  note?: string;
  range: SourceRange;
}

export interface EnumModel {
  /** `schema.name` (schema omitted when default). */
  id: string;
  name: string;
  values: { name: string; note?: string }[];
}

export interface TableModel {
  /** Stable key, `schema.table` (schema omitted when default). */
  id: string;
  name: string;
  schema?: string;
  note?: string;
  headerColor?: string;
  columns: ColumnModel[];
  range: SourceRange;
}

export type Relation = "1" | "*";

export interface RefEndpoint {
  table: string;
  columns: string[];
  relation: Relation;
}

export interface RefModel {
  id: string;
  from: RefEndpoint;
  to: RefEndpoint;
  range: SourceRange;
}

/** A floating `Note name { ... }` block (sticky note). */
export interface NoteModel {
  name: string;
  content: string;
  range: SourceRange;
}

export interface SchemaModel {
  tables: TableModel[];
  refs: RefModel[];
  notes: NoteModel[];
  enums: EnumModel[];
}

const tableId = (schema: string | null | undefined, name: string) =>
  schema && schema !== "public" ? `${schema}.${name}` : name;

const rangeOf = (token: any): SourceRange => ({
  startLine: token.start.line - 1,
  endLine: token.end.line - 1
});

/** An unqualified type name resolves within the table's own schema first, then the default one. */
function enumIdOf(type: any, schema: string | undefined, enums: EnumModel[]): string | undefined {
  const name: string = type.type_name;
  const wanted = type.schemaName ? [tableId(type.schemaName, name)] : [tableId(schema, name), name];
  return enums.find(e => wanted.includes(e.id))?.id;
}

/** Parse DBML source into a plain, serializable model. Throws on syntax errors. */
export function parseDbml(source: string): SchemaModel {
  const db = new Parser().parse(source, "dbmlv2");
  const tables: TableModel[] = [];
  const refs: RefModel[] = [];
  const enums: EnumModel[] = [];

  for (const schema of db.schemas) {
    const schemaName = schema.name === "public" ? undefined : schema.name;
    for (const e of schema.enums ?? []) {
      enums.push({
        id: tableId(schemaName, e.name),
        name: e.name,
        values: e.values.map((v: any) => ({ name: v.name, note: v.note || undefined }))
      });
    }
  }

  for (const schema of db.schemas) {
    const schemaName = schema.name === "public" ? undefined : schema.name;
    for (const t of schema.tables) {
      tables.push({
        id: tableId(schemaName, t.name),
        name: t.name,
        schema: schemaName,
        note: t.note || undefined,
        headerColor: t.headerColor || undefined,
        range: rangeOf(t.token),
        columns: t.fields.map((f: any) => ({
          name: f.name,
          type: f.type.type_name,
          pk: !!f.pk,
          notNull: !!f.not_null,
          unique: !!f.unique,
          increment: !!f.increment,
          enumId: enumIdOf(f.type, schemaName, enums),
          note: f.note || undefined,
          range: rangeOf(f.token)
        }))
      });
    }
    for (const r of schema.refs) {
      const [a, b] = r.endpoints.map((e: any) => ({
        table: tableId(e.schemaName, e.tableName),
        columns: e.fieldNames as string[],
        relation: e.relation as Relation
      }));
      refs.push({
        id: `${a.table}.${a.columns.join(",")}>${b.table}.${b.columns.join(",")}`,
        from: a,
        to: b,
        range: rangeOf(r.token)
      });
    }
  }
  const notes: NoteModel[] = (db.notes ?? []).map((n: any) => ({
    name: n.name,
    content: n.content ?? "",
    range: rangeOf(n.token)
  }));
  return { tables, refs, notes, enums };
}

/** The DBML compiler throws an object with `diags` rather than a normal Error message. */
export function describeError(e: any): string {
  const diags: any[] | undefined = e?.diags;
  if (diags?.length) {
    return diags
      .slice(0, 5)
      .map(d => `Line ${d.location?.start?.line ?? "?"}: ${d.message}`)
      .join("\n");
  }
  return String(e?.message ?? e);
}
