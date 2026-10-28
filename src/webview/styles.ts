export const css = `
html, body, #root { margin: 0; height: 100%; overflow: hidden; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family); font-size: 12px; user-select: none; }
#viewport { position: absolute; inset: 0; cursor: grab; }
#viewport.panning { cursor: grabbing; }
#world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
#lines { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; }
.ref-hit { stroke: transparent; stroke-width: 14; fill: none; cursor: pointer; pointer-events: stroke; }
.ref { stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 1.5; fill: none; pointer-events: none; }
.ref.hot { stroke: var(--vscode-focusBorder); stroke-width: 2.5; }
.dim .ref:not(.hot) { opacity: 0.2; }
.card { fill: var(--vscode-descriptionForeground); font-size: 11px; pointer-events: none; }
.card.hot { fill: var(--vscode-focusBorder); font-weight: bold; }
marker path { fill: context-stroke; }
.table { position: absolute; box-sizing: border-box; background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); border-radius: 6px;
  overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.table.hot { border-color: var(--vscode-focusBorder); }
.table-head { height: 28px; line-height: 28px; padding: 0 10px; font-weight: 600; cursor: move;
  background: var(--table-color, var(--vscode-titleBar-activeBackground, var(--vscode-editorGroupHeader-tabsBackground)));
  color: var(--vscode-titleBar-activeForeground, inherit); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.table-head small { opacity: .6; font-weight: normal; margin-right: 4px; }
.col { height: 22px; line-height: 22px; padding: 0 10px; display: flex; gap: 8px; white-space: nowrap; }
.col:hover { background: var(--vscode-list-hoverBackground); }
.col.hot { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.col .name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.col .type { opacity: .6; }
.col .badge { opacity: .8; font-size: 9px; font-weight: 700; align-self: center; border: 1px solid currentColor;
  border-radius: 3px; padding: 0 3px; line-height: 12px; }
#bar { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; padding: 4px; border-radius: 6px;
  background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); }
#bar button { background: transparent; color: inherit; border: 0; border-radius: 4px; min-width: 28px; height: 26px; cursor: pointer; font: inherit; }
#bar button:hover { background: var(--vscode-toolbar-hoverBackground); }
#bar span { align-self: center; min-width: 40px; text-align: center; opacity: .7; }
#msg { position: absolute; left: 12px; top: 12px; padding: 6px 10px; border-radius: 4px; max-width: 60%;
  background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); white-space: pre-wrap; }
#msg:empty { display: none; }
`;
