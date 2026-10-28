# Visual Editor for DBML

An offline visual editor and language support for [DBML](https://dbml.org) in VS Code. No account and no sign-in: open a `.dbml` file and edit your schema as a diagram next to the code.

<!-- TODO: add a screenshot of the diagram here, e.g. images/screenshot.png -->

## Visual editor

Open a `.dbml` file and click the preview icon in the editor title bar, or run **DBML: Open Visual Editor to the Side**. The diagram follows your edits live, and syntax errors show in a banner without clearing the diagram.

**Canvas**
- Drag the background to pan. Use two-finger scroll to pan, pinch or Ctrl/Cmd + wheel to zoom, and the bottom bar for zoom and **Fit**.
- Drag a table by its header. Shift-click or shift-drag a rectangle to select several tables and move them together.
- Click a column or a line to highlight its refs and dim the rest. Arrows point from the "many" side to the referenced key.
- Double-click a table, a column or a line to jump to its code. The cursor lands at the end of that line.
- Tables show a one-line preview of their note (hover for the full text) and badges for primary key, foreign key, unique, auto increment and column notes.

**Lines**
- Lines are horizontal and vertical only. They route around tables and spread into separate lanes so they don't run on top of each other.
- Click a line to bend it: drag a dot to slide that segment, or the hollow dots at each end to pull the line off its table. Press Del or Backspace to reset it.

**Arrange**
- **Arrange** lays out the visible tables with parents on the left, right, top or bottom, or in a grid.
- Pin a table (pin icon in its header) and Arrange will leave it where it is. Arranging resets bent lines.

**Editing the code from the diagram**
- **Link mode:** drag a column onto a column of another table to add `Ref: "parent"."col" < "child"."col"` under the child table, after any Refs that directly follow it.
- **Insert mode:** drop on the lower edge of a column instead to add a new `<parent>_<column>` column below it (same type as the parent column), plus its Ref.
- **+ Note** adds a `Note` block to the DBML and shows it as a sticky note. Double-click it to edit the text in code.
- Every edit is a normal, undoable change to your file. Nothing is saved until you save.

**Views, search and groups**
- The side panel (☰, top left) holds **views**, **tables** and search. Each view has its own table positions, camera, hidden tables, pins and bent lines. Double-click a view name to rename it.
- Hide or show tables from the table list. Search with Ctrl/Cmd + F: it matches table names, column names, types and notes, and Enter jumps between matches.
- **+ Group** adds a container that moves with the tables inside it. Double-click its title to rename, Del to delete.

### Layout file

Positions, views, pins, bent lines and containers are stored next to your file as `<name>.dbml.layout.json`, so the DBML stays clean. Commit it to share a layout, or add `*.layout.json` to your `.gitignore`.

Layout is keyed by table name, so renaming a table resets its position and pin.

## Language support

- Syntax highlighting, snippets and a file icon for `.dbml` files.
- **DBML: To SQL** exports to PostgreSQL, MySQL or SQL Server.
- **DBML: From SQL** imports a `.sql` file (PostgreSQL, MySQL or SQL Server) as DBML.

Snippets: `table`, `enum`, `oto` (one-to-one), `otm` (one-to-many), `mto` (many-to-one), `mtm` (many-to-many join table).

![Syntax example](images/dbml_syntax_example.png)

> If you also have another DBML extension installed, disable it for `.dbml` files. Two extensions registering the same language will conflict.

## Known limitations

- Bent lines are stored as fixed coordinates, so they don't follow a table you move afterwards. Reset the line to re-route it.
- The router tries a few route shapes, so very dense schemas can still get a crossing or an overlap.
- Containers move the tables inside them but don't clip or lock them.

## Development

```sh
npm install
npm run build       # bundle the extension and the webview into dist/
npm run typecheck
npm test
```

Press F5 to launch an Extension Development Host. `npm run package` builds a `.vsix`.

## Credits

Started from [mattmeyers/vscode-dbml](https://github.com/mattmeyers/vscode-dbml) (MIT, Copyright (c) 2019 Matthew Meyers), which provided the syntax grammar, snippets and SQL import/export commands. This project has since been rebranded and is developed independently. Diagram layout uses [ELK](https://github.com/kieler/elkjs), and parsing and SQL conversion use [`@dbml/core`](https://github.com/holistics/dbml).

Not affiliated with Holistics, dbdiagram.io or the DBML project. DBML is named here only to describe the file format this extension supports.

## License

[MIT](./LICENSE)
