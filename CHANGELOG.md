# Change Log

All notable changes to the "Visual Editor for DBML" extension will be documented in this file.

## [0.1.0] - Unreleased
### Added
- Visual editor (`DBML: Open Visual Editor to the Side`): pan/zoom/fit, drag and group-select tables, ref highlighting, double-click to jump to code
- Orthogonal auto-routed lines with lanes, segment bending, Del to reset
- Arrange (parents left/right/top/bottom, grid) and pinned tables
- Saved views, hide/show tables, search, sticky notes (`Note` blocks) and containers
- Link mode and insert mode to add refs and columns by dragging
- Layout sidecar file `<name>.dbml.layout.json`
- SQL Server import
- Not null (NN) and enum (E) badges; hovering an enum shows its name and values
- Release workflow: pushing a `v*` tag builds the `.vsix` and attaches it to a GitHub release

### Changed
- Rebranded from vscode-dbml to Visual Editor for DBML; command IDs are now `dbmlVisualEditor.*`
- Replaced webpack with esbuild, updated all dependencies (`@dbml/core` 11)

## Earlier history (vscode-dbml by Matthew Meyers)

## [0.4.1] - 2024-10-14
### Added
- DBML file icon (Thanks @BOCOVO)

## [0.4.0] - 2024-10-14
### Added
- Support for `TableGroup` (Thanks @CJSantee)
- DBML logo (Thanks @CJSantee)

## [0.3.5] - 2021-03-01
### Updated
- Bump @dbml/core version

## [0.3.4] - 2020-07-01
### Updated
- Added timestamptz to keywords for PostgreSQL compliance

## [0.3.3] - 2020-05-11
### Updated
- Bumped @dbml/core version to 2.0.1

## [0.3.2] - 2020-04-30
### Added
- Syntax highlighting for Projects and multiline comments

## [0.3.1] - 2019-12-12
### Added
- Success and failure message on file generation

### Removed
- MSSQL dialect from `DBML: From SQL` command

## [0.3.0] - 2019-12-12
### Added
- Import From SQL command

### Updated
- Restructured syntax to account for the actual structure of the document
- Added new command and image to README

## [0.2.1] - 2019-12-10
### Added
- Webpack configuration
- Configuration for publishing

### Removed
- Removed installation instructions from README

## [0.2.0] - 2019-12-10
### Added
- Export to SQL command

### Updated
- Added command information to the README
- Added autoincrement option to table snippet

## [0.1.0] - 2019-12-06
### Added
- Basic syntax highlighting based on the DBML parser keywords.
- Snippets for table and ref generation
- Test file containing the [dbdiagram](https://dbdiagram.io) sample for checking syntax highlighting
- README with extension features
- MIT License
