# Visual Editor for DBML

An offline visual editor and language support for the Database Markup Language ([DBML](https://dbml.org)) in VS Code. No account, no sign-in.

> **Status: early development.** Run `DBML: Open Visual Editor` on a `.dbml` file to open the diagram: pan, zoom, fit, drag tables, click a column or line to highlight its refs, double-click a table, column or line to jump to its code. Tables without a saved position are placed in a simple grid for now. See [PLAN.md](./PLAN.md).

Layout (positions, views, notes, containers) is stored in a sidecar file, `<name>.dbml.layout.json`, which you can commit or gitignore.

## Syntax Highlighting

Syntax highlighting is enabled for files with the `.dbml` extension.

![Syntax Example](https://raw.githubusercontent.com/Nopparuj-an/dbml-visual-editor/master/images/dbml_syntax_example.png)

## Commands

### To SQL

When focusing a `.dbml` file, the `DBML: To SQL` command becomes available in the command palette. This command leverages the `@dbml/core` ([source](https://github.com/holistics/dbml/tree/master/packages/dbml-core)) package to generate an SQL script based on the provided schema.

Selecting this commands presents all available dialects. At this time the three available dialects are PostgreSQL, MySQL, and SQL Server. After choosing a dialect, enter an output filename. If a relative path is provided, the generated file will be placed relative to the focused `.dbml` file. Otherwise is will be placed at the provided absolute path.

### From SQL

When focusing a `.sql` file, the `DBML: From SQL` command appears in the command palette. This command acts as the opposite of the `DBML: To SQL` command and generates a `.dbml` from from the provided `.sql` file. The dialect of the SQL must be provided. At this time, this command only works for PostgreSQL and MySQL.

## Snippets

Snippets are provided for quickly creating tables, enums, and references. To use a snippet, begin typing any of the following keys.

- `table`: Create a new table with an auto-incrementing int id as the primary key
- `enum`: Create a new enum
- `oto`: Create a one-to-one reference
- `otm`: Create a one-to-many reference
- `mto`: Create a many-to-one reference
- `mtm`: Create a many-to-many join table

## Credits

This project began from [mattmeyers/vscode-dbml](https://github.com/mattmeyers/vscode-dbml) (MIT, Copyright (c) 2019 Matthew Meyers), which provided the syntax grammar, snippets, and SQL import/export commands. It has since been rebranded and is developed independently.

Not affiliated with Holistics, dbdiagram.io, or the DBML project. DBML is used here only to describe the file format this extension supports.

[license]: ./LICENSE
