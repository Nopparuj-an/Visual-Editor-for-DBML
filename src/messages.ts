import type { ColumnRef } from "./edits";
import type { LayoutFile } from "./layout";
import type { SchemaModel } from "./model";

export type ToWebview =
  /** `layout` is only sent on load; afterwards the webview owns it. */
  | { type: "state"; schema: SchemaModel | null; error?: string; layout?: LayoutFile };

export type ToExtension =
  | { type: "ready" }
  | { type: "saveLayout"; layout: LayoutFile }
  | { type: "reveal"; line: number }
  /** Link mode: add a Ref between existing columns. */
  | { type: "addRef"; parent: ColumnRef; child: ColumnRef }
  /** Insert mode: add a new column (and its Ref) after `child.after`. */
  | { type: "insertColumn"; parent: ColumnRef; child: { table: string; after: string } }
  | { type: "addNote" };
