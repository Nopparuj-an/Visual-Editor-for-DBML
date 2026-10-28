import type { LayoutFile } from "./layout";
import type { SchemaModel } from "./model";

export type ToWebview =
  | { type: "state"; schema: SchemaModel | null; error?: string; layout: LayoutFile };

export type ToExtension =
  | { type: "ready" }
  | { type: "saveLayout"; layout: LayoutFile }
  | { type: "reveal"; line: number };
