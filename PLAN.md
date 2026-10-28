# Plan

## Architecture
- **Source of truth:** the `.dbml` file, parsed with `@dbml/core` (`src/model.ts`) into a plain model with source line ranges.
- **Layout:** sidecar `<file>.dbml.layout.json` (`src/layout.ts`): positions, views, hidden/pinned tables, line waypoints, notes, containers. Keyed by table id / ref id.
- **Webview:** DOM tables in one CSS-transformed layer, SVG for lines, generous debounced culling (no aggressive offscreen unloading). Targets 50-100 tables.
- **Edits to code** go through `WorkspaceEdit` only, never whole-file rewrites.
- **Messages** between extension and webview are typed in `src/messages.ts`.
- **Auto arrange:** ELK layered for placement (supports fixed/pinned nodes), orthogonal edge routing; custom obstacle-aware router later if ELK is not enough.

## Phases
1. Foundation (done): rebrand, esbuild, vitest, panel + model + layout scaffold.
2. Viewer MVP: render tables/refs, pan/zoom/fit, theming, double-click to source.
3. Layout persistence: drag, group drag, views, hide/show, search.
4. Interactions: ref highlight + direction, icons, note previews, reset line (Del), link/insert modes, notes, containers.
5. Auto arrange: ELK placement/routing, pins, custom routing pass.
