export const css = `
html, body, #root { margin: 0; height: 100%; overflow: hidden; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family); font-size: 12px; user-select: none; }
#viewport { position: absolute; inset: 0 0 0 240px; overflow: hidden; cursor: grab; }
#viewport.panning { cursor: grabbing; }
#world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
#lines { z-index: 1; position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; }
.ref-hit { stroke: transparent; stroke-width: 14; fill: none; cursor: pointer; pointer-events: stroke; }
.ref { stroke: var(--vscode-editorLineNumber-foreground); stroke-width: 1.5; fill: none; pointer-events: none; }
.ref.hot { stroke: var(--vscode-focusBorder); stroke-width: 2.5; }
.dim .ref:not(.hot) { opacity: 0.2; }
.card { fill: var(--vscode-descriptionForeground); font-size: 11px; pointer-events: none; }
.card.hot { fill: var(--vscode-focusBorder); font-weight: bold; }
marker path { fill: context-stroke; }
.table { z-index: 2; position: absolute; box-sizing: border-box; background: var(--vscode-editorWidget-background);
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
.sticky { position: absolute; z-index: 2; box-sizing: border-box; padding: 8px 10px; background: #f6e58d; color: #2d2a1c; border-radius: 3px;
  box-shadow: 2px 3px 8px rgba(0,0,0,.35); cursor: move; max-height: 260px; overflow: hidden; }
.sticky-title { font-weight: 700; font-size: 10px; text-transform: uppercase; opacity: .6; margin-bottom: 4px; }
.sticky-body { white-space: pre-wrap; line-height: 1.4; }
.sticky.sel { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.container { position: absolute; z-index: 0; box-sizing: border-box; border: 2px dashed var(--vscode-editorLineNumber-foreground);
  border-radius: 10px; background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent); pointer-events: none; }
.container.sel { border-color: var(--vscode-focusBorder); }
.c-title { pointer-events: auto; position: absolute; left: 10px; top: -14px; padding: 2px 10px; border-radius: 10px; cursor: move;
  background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); font-weight: 600; }
.container input { position: absolute; left: 10px; top: -14px; pointer-events: auto; font: inherit; }
.c-resize { pointer-events: auto; position: absolute; right: -6px; bottom: -6px; width: 14px; height: 14px; cursor: nwse-resize; border-radius: 3px;
  background: var(--vscode-editorLineNumber-foreground); opacity: .6; }
.col.drop-link { outline: 2px solid var(--vscode-focusBorder); outline-offset: -2px; }
.col.drop-insert { box-shadow: inset 0 -3px 0 var(--vscode-focusBorder); }
.link-ghost { fill: none; stroke: var(--vscode-focusBorder); stroke-width: 2; stroke-dasharray: 5 4; }
#tip { position: fixed; z-index: 100; max-width: 320px; padding: 6px 9px; border-radius: 4px; white-space: pre-wrap; pointer-events: none;
  background: var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background)); color: var(--vscode-editorHoverWidget-foreground, inherit);
  border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-editorWidget-border)); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
#tip[hidden] { display: none; }
.pin { position: absolute; right: 7px; top: 8px; z-index: 1; width: 16px; height: 16px; padding: 0; display: flex; align-items: center; justify-content: center;
  background: transparent; color: inherit; border: 0; border-radius: 3px; cursor: pointer; opacity: 0; }
.table:hover .pin { opacity: .5; }
.table .pin.on { opacity: 1; color: var(--vscode-focusBorder); }
.pin:hover { background: var(--vscode-toolbar-hoverBackground); opacity: 1; }
.table-head { padding-right: 28px !important; }
#menu { position: absolute; right: 12px; bottom: 56px; z-index: 10; display: flex; flex-direction: column; padding: 4px; border-radius: 6px;
  background: var(--vscode-menu-background, var(--vscode-editorWidget-background)); border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
  box-shadow: 0 2px 8px rgba(0,0,0,.3); }
#menu[hidden] { display: none; }
#menu button { background: transparent; color: inherit; border: 0; text-align: left; padding: 5px 12px; border-radius: 4px; cursor: pointer; font: inherit; }
#menu button:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); }
.table-note { height: 20px; line-height: 20px; padding: 0 10px; font-style: italic; opacity: .7; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); box-sizing: border-box; }
#overlay { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; z-index: 3; }
.handle { fill: var(--vscode-focusBorder); stroke: var(--vscode-editor-background); stroke-width: 2; pointer-events: all; cursor: grab; }
.handle.ghost { fill: var(--vscode-editor-background); stroke: var(--vscode-focusBorder); stroke-width: 1.5; opacity: .8; }
.col .badge.note { width: 13px; height: 13px; box-sizing: border-box; padding: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-style: normal; line-height: 1; }
.col .badge { opacity: .8; font-size: 9px; font-weight: 700; align-self: center; border: 1px solid currentColor;
  border-radius: 3px; padding: 0 3px; line-height: 12px; }
#bar { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; padding: 4px; border-radius: 6px;
  background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); }
#bar button { background: transparent; color: inherit; border: 0; border-radius: 4px; min-width: 28px; height: 26px; cursor: pointer; font: inherit; }
#bar button:hover { background: var(--vscode-toolbar-hoverBackground); }
#bar span { align-self: center; min-width: 40px; text-align: center; opacity: .7; }
#sideToggle { position: absolute; left: 8px; top: 8px; z-index: 2; width: 34px; height: 34px; border-radius: 5px; cursor: pointer; font-size: 18px;
  background: var(--vscode-editorWidget-background); color: inherit; border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); font: inherit; }
#sideToggle:hover { background: var(--vscode-toolbar-hoverBackground); }
#sideToggle.open { background: transparent; border-color: transparent; }
#msg { position: absolute; left: 48px; top: 12px; padding: 6px 10px; border-radius: 4px; max-width: 60%;
  background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); white-space: pre-wrap; }
#msg:empty { display: none; }
#side { position: absolute; left: 0; top: 0; bottom: 0; width: 240px; box-sizing: border-box; overflow-y: auto;
  border-right: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background, var(--vscode-editor-background)); padding: 8px; }
#search { margin-top: 38px; }
#side input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px; padding: 4px 6px; font: inherit; user-select: text; }
#side input:focus { outline: 1px solid var(--vscode-focusBorder); }
.section { margin-top: 14px; }
.section-head { display: flex; align-items: center; gap: 2px; text-transform: uppercase; font-size: 10px; letter-spacing: .05em; opacity: .7; margin-bottom: 4px; }
.section-head span { flex: 1; }
.row { display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 3px; cursor: pointer; height: 22px; }
.row:hover { background: var(--vscode-list-hoverBackground); }
.row.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.row.off { opacity: .45; }
.grow { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button.icon { background: transparent; color: inherit; border: 0; cursor: pointer; border-radius: 3px; padding: 0 5px; height: 20px; font: inherit; }
button.icon:hover { background: var(--vscode-toolbar-hoverBackground); }
.table.sel { outline: 2px solid var(--vscode-focusBorder); outline-offset: 1px; }
.table.faded { opacity: .25; }
.col.found { background: var(--vscode-editor-findMatchHighlightBackground); }
#marquee { position: absolute; border: 1px dashed var(--vscode-focusBorder); background: var(--vscode-editor-selectionBackground); opacity: .5; pointer-events: none; }
#marquee[hidden] { display: none; }
`;
