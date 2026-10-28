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
  note?: string;
  range: SourceRange;
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

export interface SchemaModel {
  tables: TableModel[];
  refs: RefModel[];
}

const tableId = (schema: string | null | undefined, name: string) =>
  schema && schema !== "public" ? `${schema}.${name}` : name;

const rangeOf = (token: any): SourceRange => ({
  startLine: token.start.line - 1,
  endLine: token.end.line - 1
});

/** Parse DBML source into a plain, serializable model. Throws on syntax errors. */
export function parseDbml(source: string): SchemaModel {
  const db = new Parser().parse(source, "dbmlv2");
  const tables: TableModel[] = [];
  const refs: RefModel[] = [];

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
  return { tables, refs };
}
