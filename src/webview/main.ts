import type { ToExtension, ToWebview } from "../messages";

declare function acquireVsCodeApi(): { postMessage(m: ToExtension): void };

const vscode = acquireVsCodeApi();
const root = document.getElementById("root")!;

window.addEventListener("message", e => {
  const m = e.data as ToWebview;
  if (m.type !== "state") {
    return;
  }
  root.textContent = m.schema
    ? `${m.schema.tables.length} tables, ${m.schema.refs.length} refs`
    : `Parse error: ${m.error}`;
});

vscode.postMessage({ type: "ready" });
