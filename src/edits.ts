import type { SchemaModel, TableModel } from "./model";

/** Insert `text` as new line(s) before 0-based `line` (which may equal `lines.length`). */
export interface LineInsert {
  line: number;
  text: string;
}

export interface ColumnRef {
  table: string;
  column: string;
}

/** `schema.table` -> `"schema"."table"`. */
const quote = (id: string) => id.split(".").map(p => `"${p}"`).join(".");

export function singular(word: string): string {
  if (/ies$/i.test(word)) {
    return word.replace(/ies$/i, "y");
  }
  if (/(sses|xes|ches|shes)$/i.test(word)) {
    return word.replace(/es$/i, "");
  }
  return /ss$/i.test(word) ? word : word.replace(/s$/i, "");
}

const findTable = (model: SchemaModel, id: string): TableModel => {
  const t = model.tables.find(x => x.id === id);
  if (!t) {
    throw new Error(`Unknown table ${id}`);
  }
  return t;
};

/** Where a new `Ref:` for `table` goes: under the table, after any single-line Refs that directly follow it. */
function refInsertLine(lines: string[], table: TableModel): number {
  let at = table.range.endLine + 1;
  for (let j = at; j < lines.length; j++) {
    if (/^\s*Ref\b[^{]*$/.test(lines[j])) {
      at = j + 1;
    } else if (lines[j].trim() !== "") {
      break;
    }
  }
  return at;
}

function refInsert(lines: string[], model: SchemaModel, parent: ColumnRef, child: ColumnRef): LineInsert {
  const at = refInsertLine(lines, findTable(model, child.table));
  let text = `Ref: ${quote(parent.table)}."${parent.column}" < ${quote(child.table)}."${child.column}"`;
  if (lines[at] !== undefined && lines[at].trim() !== "") {
    text += "\n"; // keep a blank line before whatever follows
  }
  return { line: at, text };
}

/** Link mode: add a `Ref:` from an existing child column to the parent column. */
export function planAddRef(lines: string[], model: SchemaModel, parent: ColumnRef, child: ColumnRef): LineInsert[] {
  return [refInsert(lines, model, parent, child)];
}

/** Insert mode: add `<parent>_<column>` after `after` in the child table, plus the `Ref:` for it. */
export function planInsertColumn(
  lines: string[],
  model: SchemaModel,
  parent: ColumnRef,
  child: { table: string; after: string }
): LineInsert[] {
  const parentTable = findTable(model, parent.table);
  const parentCol = parentTable.columns.find(c => c.name === parent.column);
  const childTable = findTable(model, child.table);
  const after = childTable.columns.find(c => c.name === child.after);
  if (!parentCol || !after) {
    throw new Error("Unknown column");
  }

  const base = `${singular(parentTable.name)}_${parent.column}`;
  const taken = new Set(childTable.columns.map(c => c.name));
  let name = base;
  for (let i = 2; taken.has(name); i++) {
    name = `${base}_${i}`;
  }

  const indent = /^\s*/.exec(lines[after.range.startLine])?.[0] ?? "  ";
  const type = /\s/.test(parentCol.type) ? `"${parentCol.type}"` : parentCol.type;
  return [
    { line: after.range.endLine + 1, text: `${indent}${name} ${type}` },
    refInsert(lines, model, parent, { table: child.table, column: name })
  ];
}

/** A `Note name { ... }` block with a name not used yet. */
export function planAddNote(lines: string[], model: SchemaModel): LineInsert {
  const taken = new Set(model.notes.map(n => n.name));
  let i = 1;
  while (taken.has(`note_${i}`)) {
    i++;
  }
  const last = lines.length && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
  return { line: last, text: `\nNote note_${i} {\n  'New note'\n}` };
}
