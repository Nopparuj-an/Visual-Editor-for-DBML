import * as vscode from "vscode";
import Exporter from "./toSql";
import Importer from "./fromSql";
import { EditorPanel } from "./panel";

export enum Dialect {
  postgres = "PostgreSQL",
  mysql = "MySQL",
  mssql = "SQL Server"
}

export function activate(context: vscode.ExtensionContext) {
  const exporter = new Exporter();
  const importer = new Importer();

  const exportCmd = vscode.commands.registerCommand("dbmlVisualEditor.toSql", () => exporter.export());
  const importCmd = vscode.commands.registerCommand("dbmlVisualEditor.fromSql", () => importer.import());

  const openCmd = vscode.commands.registerCommand("dbmlVisualEditor.open", () =>
    EditorPanel.show(context)
  );

  context.subscriptions.push(exportCmd, importCmd, openCmd);
}

export function deactivate() {}
