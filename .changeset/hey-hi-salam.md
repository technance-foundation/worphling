---
"@technance/worphling": patch
---

Introduce a centralized CLI schema to eliminate duplication between argument parsing and help output.

### Improvements

- Added `cliSchema.ts` as a single source of truth for:
    - commands
    - options
    - examples

- Derived CLI behavior from schema:
    - `minimist` configuration is now generated dynamically
    - command validation uses schema (`isCliCommandName`)
    - report format validation uses schema (`isCliReportFormat`)
    - help output is fully generated from schema

- Removed hardcoded CLI definitions from `Cli.ts`
- Removed stale references to deprecated flags such as `--ci`

### Why

Previously, CLI flags, commands, and help output were defined in multiple places, which led to drift (e.g. forgotten `--ci` references after removal).

This change:

- ensures consistency across parsing, validation, and help output
- reduces maintenance overhead
- makes adding/removing CLI options safe and predictable

Future CLI changes now require updating a single file (`cliSchema.ts`).
