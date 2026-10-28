import * as vscode from "vscode";
import { LayoutFile, readLayout, writeLayout } from "./layout";
import type { ToExtension, ToWebview } from "./messages";
import { parseDbml } from "./model";

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
        return this.push();
      case "saveLayout":
        return writeLayout(this.doc.uri, m.layout);
      case "reveal": {
        const pos = new vscode.Position(m.line, 0);
        await vscode.window.showTextDocument(this.doc, {
          viewColumn: vscode.ViewColumn.One,
          selection: new vscode.Range(pos, pos)
        });
      }
    }
  }

  private async push() {
    const layout: LayoutFile = await readLayout(this.doc.uri);
    let msg: ToWebview;
    try {
      msg = { type: "state", schema: parseDbml(this.doc.getText()), layout };
    } catch (e: any) {
      msg = { type: "state", schema: null, error: String(e?.message ?? e), layout };
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
