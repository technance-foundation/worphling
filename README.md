# Worphling

**Keep your translations in sync with AI-powered automation.**

Worphling is a CLI for managing localization files end-to-end. It detects missing, outdated, and unused translations, automatically translates new content with AI models such as OpenAI, validates ICU messages and rich-text tags, and produces structured reports suitable for CI and automation.

---

## What Worphling Does

Worphling helps you:

- Automatically translate missing keys using AI
- Retranslate keys when the source text changes
- Remove keys that no longer exist in the source locale
- Validate placeholders, ICU messages, and rich-text tags
- Generate JSON or Markdown reports
- Run safely in CI with deterministic behavior and stable exit codes

---

## Install

```bash
pnpm add -D @technance/worphling
```

Or globally:

```bash
pnpm add -g @technance/worphling
```

---

## Quick Start

```bash
# Check the current state of your locale files
worphling check

# Automatically translate and synchronize everything
worphling sync --write
```

---

## The Main Use Case

Most teams use Worphling for this workflow:

1. A source locale such as `en` is the source of truth
2. Developers add or change source messages
3. Worphling compares the current source locale against its stored snapshot
4. Worphling detects missing, outdated, and extra entries
5. Worphling translates missing or outdated entries with AI
6. Worphling removes stale keys
7. CI verifies that everything stays consistent

---

## Commands

### `check`

Analyze locale files without changing them.

```bash
worphling check
```

Detects:

- missing translations
- extra keys
- source changes requiring retranslation
- validation issues

Best for CI and verification.

---

### `translate`

```bash
worphling translate --write
```

- translates missing keys
- retranslates modified source keys
- does NOT remove extra keys

---

### `fix`

```bash
worphling fix --write
```

- removes extra keys
- no translation

---

### `sync`

```bash
worphling sync --write
```

Full lifecycle:

- translate missing
- retranslate modified
- remove extra

---

### `report`

```bash
worphling report --report-file ./.worphling/worphling-report.md
```

Outputs a standalone report.

---

## Common Flags

> CLI flags override config-level runtime settings.

### `--write`

Apply changes to disk.

---

### `--report-file`

```bash
worphling check --report-file ./.worphling/report.json
```

---

### `--report-format`

```bash
worphling report --report-format markdown
```

---

### `--locales`

```bash
worphling sync --locales fa,de --write
```

---

### `--config`

```bash
worphling check --config ./worphling.config.mjs
```

---

### `--dry-run`

```bash
worphling sync --dry-run
```

---

### `--fail-on-changes`

Fail when any diff exists.

```bash
worphling check --fail-on-changes
```

---

### `--fail-on-warnings`

Fail when warnings exist.

```bash
worphling check --fail-on-warnings
```

---

## Configuration

```json
{
    "sourceLocale": "en",
    "localesDir": "./locales",
    "filePattern": "*.json",

    "provider": {
        "name": "openai",
        "apiKey": "YOUR_API_KEY",
        "model": "gpt-5.1-2025-11-13",
        "temperature": 0
    },

    "plugin": {
        "name": "none"
    },

    "snapshot": {
        "file": "./.worphling/.worphling-snapshot.json"
    },

    "output": {
        "sortKeys": true,
        "preserveIndentation": 2,
        "trailingNewline": true
    },

    "validation": {
        "preservePlaceholders": true,
        "preserveIcuSyntax": true,
        "preserveHtmlTags": true,
        "failOnExtraKeys": false,
        "failOnMissingKeys": true,
        "failOnModifiedSource": false
    },

    "translation": {
        "batchSize": 100,
        "maxRetries": 3,
        "concurrency": 2,
        "exactLength": false,
        "contextFile": "./translation-context.md"
    },

    "runtime": {
        "reportFile": "./.worphling/worphling-report.json",
        "failOnChanges": false,
        "failOnWarnings": false
    }
}
```

---

## Runtime Behavior (Important)

The `runtime` section controls failure behavior and reporting defaults.

### Precedence

```
CLI flags > runtime config > defaults
```

---

### `failOnChanges`

If enabled, **any detected diff (missing, extra, modified)** causes failure.

```json
{
    "runtime": {
        "failOnChanges": true
    }
}
```

---

### `failOnWarnings`

If enabled, warnings also fail the run.

---

### `reportFile`

Default output file when `--report-file` is not provided.

---

## Exit Codes

| Code | Meaning               |
| ---- | --------------------- |
| `0`  | Success               |
| `1`  | General runtime error |
| `2`  | Config error          |
| `3`  | Validation error      |
| `4`  | Provider error        |

---

### Important Design Note

Worphling intentionally **does NOT use a separate "changes detected" exit code**.

Instead:

- `failOnChanges` → returns **ValidationError (3)**
- `failOnWarnings` → returns **ValidationError (3)**

This keeps CI behavior simple and predictable:

👉 **"Anything that should fail CI = validation error"**

---

## Typical Workflows

### Local dev

```bash
worphling sync --write
```

---

### CI

```bash
worphling check --fail-on-changes --report-file ./.worphling/worphling-report.json
```

---

### Generate report

```bash
worphling report --report-file ./.worphling/worphling-report.md
```

---

## Recommended Setup

```json
{
    "sourceLocale": "en",
    "filePattern": "*.json",

    "plugin": {
        "name": "none"
    },

    "snapshot": {
        "file": "./.worphling/.worphling-snapshot.json"
    },

    "validation": {
        "preservePlaceholders": true,
        "preserveIcuSyntax": true,
        "preserveHtmlTags": true,
        "failOnMissingKeys": true
    },

    "runtime": {
        "reportFile": "./.worphling/worphling-report.json",
        "failOnChanges": true
    }
}
```
