import * as vscode from "vscode";

/** Persisted next to the DBML file as `<file>.layout.json`, so it can be gitignored. */
export interface LayoutFile {
  version: 1;
  activeView: string;
  views: Record<string, ViewState>;
}

export interface ViewState {
  name: string;
  camera: { x: number; y: number; zoom: number };
  tables: Record<string, { x: number; y: number; hidden?: boolean; pinned?: boolean }>;
  /** Manual waypoints per ref id; deleting an entry resets that line. */
  lines: Record<string, { x: number; y: number }[]>;
  notes: { id: string; x: number; y: number; w: number; h: number; text: string }[];
  containers: { id: string; x: number; y: number; w: number; h: number; title: string }[];
}

export const emptyLayout = (): LayoutFile => ({
  version: 1,
  activeView: "default",
  views: {
    default: {
      name: "Default",
      camera: { x: 0, y: 0, zoom: 1 },
      tables: {},
      lines: {},
      notes: [],
      containers: []
    }
  }
});

export const layoutUri = (dbml: vscode.Uri) => dbml.with({ path: `${dbml.path}.layout.json` });

export async function readLayout(dbml: vscode.Uri): Promise<LayoutFile> {
  try {
    const bytes = await vscode.workspace.fs.readFile(layoutUri(dbml));
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return emptyLayout();
  }
}

export async function writeLayout(dbml: vscode.Uri, layout: LayoutFile): Promise<void> {
  const text = JSON.stringify(layout, null, 2) + "\n";
  await vscode.workspace.fs.writeFile(layoutUri(dbml), Buffer.from(text, "utf8"));
}
