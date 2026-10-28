import * as vscode from "vscode";
import { LayoutFile, readLayout, writeLayout } from "./layout";
import type { ToExtension, ToWebview } from "./messages";
import { LineInsert, planAddNote, planAddRef, planInsertColumn } from "./edits";
import { describeError, parseDbml } from "./model";

export class EditorPanel {
  private static current: EditorPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext) {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || doc.languageId !== "dbml") {
      vscode.window.showWarningMessage("Open a .dbml file first.");
      return;
    }
    EditorPanel.current?.panel.dispose();
    EditorPanel.current = new EditorPanel(context, doc);
  }

  private readonly panel: vscode.WebviewPanel;

  private constructor(context: vscode.ExtensionContext, private doc: vscode.TextDocument) {
    const dist = vscode.Uri.joinPath(context.extensionUri, "dist");
    this.panel = vscode.window.createWebviewPanel(
      "dbmlVisualEditor",
      `${vscode.workspace.asRelativePath(doc.uri)} (visual)`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [dist] }
    );
    // A dimmer variant of the DBML file icon, so the diagram tab reads differently from the code tab.
    this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "icons", "dbml-viewer.svg");
    this.panel.webview.html = this.html(dist);

    this.panel.webview.onDidReceiveMessage(
      (m: ToExtension) => this.onMessage(m),
      undefined,
      this.disposables
    );
    vscode.workspace.onDidChangeTextDocument(
      e => e.document === this.doc && this.push(),
      undefined,
      this.disposables
    );
    this.panel.onDidDispose(() => {
      EditorPanel.current = undefined;
      this.disposables.forEach(d => d.dispose());
    });
  }

  private async onMessage(m: ToExtension) {
    switch (m.type) {
      case "ready":
        return this.push(await readLayout(this.doc.uri));
      case "saveLayout":
        return writeLayout(this.doc.uri, m.layout);
      case "addRef":
        return this.edit(lines => planAddRef(lines, parseDbml(this.doc.getText()), m.parent, m.child));
      case "insertColumn":
        return this.edit(lines => planInsertColumn(lines, parseDbml(this.doc.getText()), m.parent, m.child));
      case "addNote":
        return this.edit(lines => [planAddNote(lines, parseDbml(this.doc.getText()))]);
      case "reveal": {
        // Put the cursor at the end of the line, not the start.
        const end = this.doc.lineAt(Math.min(m.line, this.doc.lineCount - 1)).range.end;
        const editor = await vscode.window.showTextDocument(this.doc, {
          viewColumn: vscode.ViewColumn.One,
          selection: new vscode.Range(end, end)
        });
        editor.revealRange(new vscode.Range(end, end), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }
    }
  }

  /** Apply line insertions computed against the current text as one undoable edit. */
  private async edit(plan: (lines: string[]) => LineInsert[]) {
    let inserts: LineInsert[];
    try {
      inserts = plan(this.doc.getText().split(/\r?\n/));
    } catch (e: any) {
      vscode.window.showErrorMessage(`Cannot edit: ${describeError(e)}`);
      return;
    }
    const we = new vscode.WorkspaceEdit();
    for (const { line, text } of inserts) {
      if (line >= this.doc.lineCount) {
        const end = this.doc.lineAt(this.doc.lineCount - 1).range.end;
        we.insert(this.doc.uri, end, (end.character > 0 ? "\n" : "") + text + "\n");
      } else {
        we.insert(this.doc.uri, new vscode.Position(line, 0), text + "\n");
      }
    }
    await vscode.workspace.applyEdit(we);
  }

  private push(layout?: LayoutFile) {
    let msg: ToWebview;
    try {
      msg = { type: "state", schema: parseDbml(this.doc.getText()), layout };
    } catch (e: any) {
      msg = { type: "state", schema: null, error: describeError(e), layout };
    }
    this.panel.webview.postMessage(msg);
  }

  private html(dist: vscode.Uri): string {
    const w = this.panel.webview;
    const script = w.asWebviewUri(vscode.Uri.joinPath(dist, "webview.js"));
    const nonce = Math.random().toString(36).slice(2);
    return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
</head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}
