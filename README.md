# Worphling

**Keep your translations in sync with AI-powered automation.**

Worphling is a CLI for managing localization files end-to-end. It detects missing, outdated, and unused translations, automatically translates new content with AI models such as OpenAI, validates ICU messages and rich-text tags, and produces CI-friendly reports.

---

## What Worphling Does

Worphling helps you:

- automatically translate missing keys using AI
- retranslate keys when the source text changes
- remove keys that no longer exist in the source locale
- validate placeholders, ICU messages, and rich-text tags
- generate JSON or Markdown reports
- run safely in CI with stable exit codes

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

Use this to detect:

- missing translations
- extra keys
- source changes that require retranslation
- validation issues

Best for CI and verification.

---

### `translate`

Generate translations with AI for missing and outdated keys.

```bash
worphling translate --write
```

This command:

- translates missing keys
- retranslates keys whose source text changed
- does not remove extra keys

Use this when you want AI translation without cleanup.

---

### `fix`

Remove keys that no longer exist in the source locale.

```bash
worphling fix --write
```

This command:

- removes extra keys
- does not translate anything

Use this when you only want cleanup.

---

### `sync`

Fully synchronize locale files.

```bash
worphling sync --write
```

This is the recommended default command.

It will:

- translate missing keys with AI
- retranslate outdated keys with AI
- remove extra keys

If you want one command that keeps locale files healthy, use `sync`.

---

### `report`

Generate a standalone report.

```bash
worphling report --report-file ./.worphling/worphling-report.md
```

Useful for:

- CI artifacts
- debugging translation drift
- sharing translation status with the team

---

## Common Flags

### `--write`

Apply changes to disk.

```bash
worphling sync --write
```

Without `--write`, Worphling stays read-only.

---

### `--ci`

Run in CI mode.

```bash
worphling check --ci
```

CI mode is designed to be non-mutating and deterministic.

---

### `--report-file`

Write a report file.

```bash
worphling check --report-file ./.worphling/report.json
```

Supported output:

- `.json`
- `.md`
- `.markdown`

---

### `--report-format`

Force a report format explicitly.

```bash
worphling report --report-format markdown --report-file ./report.out
```

Supported values:

- `json`
- `markdown`

---

### `--locales`

Restrict execution to specific locales.

```bash
worphling sync --locales fa,de --write
```

---

### `--config`

Use a specific config file.

```bash
worphling check --config ./worphling.config.mjs
```

---

### `--dry-run`

Run planned execution without writing files.

```bash
worphling sync --dry-run
```

This is useful when you want to preview what would happen.

---

## Configuration

Example config:

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
    "ci": {
        "mode": false,
        "reportFile": "./.worphling/worphling-report.json",
        "failOnChanges": false,
        "failOnWarnings": false
    }
}
```

---

## Snapshot State

Worphling uses a required snapshot file to detect when source messages have changed.

This snapshot is part of Worphling's normal operation and should be committed to version control, similar to a lockfile.

Example:

```json
{
    "snapshot": {
        "file": "./.worphling/.worphling-snapshot.json"
    }
}
```

The snapshot stores flattened source-locale values and allows Worphling to determine when existing translations need retranslation.

---

## AI Translation

Worphling can automatically translate your locale content using an AI provider.

Today, the main provider is OpenAI.

### Provider config

```json
{
    "provider": {
        "name": "openai",
        "apiKey": "YOUR_API_KEY",
        "model": "gpt-5.1-2025-11-13",
        "temperature": 0
    }
}
```

### How translation works

When you run `translate` or `sync`, Worphling will:

- collect missing keys
- collect keys that need retranslation based on the source snapshot
- batch requests
- execute them with bounded concurrency
- retry failures
- merge results deterministically

### Translation context

You can provide additional translation guidance with `translation.contextFile`.

```json
{
    "translation": {
        "contextFile": "./translation-context.md"
    }
}
```

This file can include:

- glossary rules
- product terminology
- tone and voice
- formatting requirements
- brand language guidance

Example:

```md
Use formal Persian.
Keep financial terms consistent.
Do not translate product names.
Prefer concise mobile-friendly phrasing.
```

---

## ICU Message Support

Worphling treats **ICU message syntax as the default message model** for translations.

That means it is designed to work well with messages such as:

```txt
Hello {name}
```

```txt
You have {count, plural, =0 {no messages} =1 {one message} other {# messages}}.
```

```txt
{gender, select, female {She} male {He} other {They}} is online.
```

### Why this matters

AI translation is powerful, but structured messages can break if placeholders or ICU branches are changed incorrectly.

Worphling helps prevent that by validating message structure before you trust the result.

---

## Validation

Worphling can validate translation structure to prevent broken messages.

### Placeholder preservation

```json
{
    "validation": {
        "preservePlaceholders": true
    }
}
```

Example:

- source: `Hello {name}`
- target must still contain `{name}`

### ICU syntax preservation

```json
{
    "validation": {
        "preserveIcuSyntax": true
    }
}
```

Example:

- plural, select, and selectordinal structures must remain intact

### HTML and rich-text tag preservation

```json
{
    "validation": {
        "preserveHtmlTags": true
    }
}
```

Example:

- source: `Hello <bold>{name}</bold>`
- target must preserve the tag structure

---

## Plugins

Worphling uses ICU as its core message format. Plugins are only for **framework-specific behavior** layered on top of that.

### `none`

Default behavior.

```json
{
    "plugin": {
        "name": "none"
    }
}
```

Use this for general ICU-based translation workflows.

### `next-intl`

Use this when your app is built with `next-intl`.

```json
{
    "plugin": {
        "name": "next-intl"
    }
}
```

`next-intl` uses ICU messages and commonly relies on rich-text tag patterns such as:

```txt
Hello <bold>{name}</bold>
```

This plugin adds framework-specific prompting and validation behavior for those conventions.

---

## Reports

Worphling can generate structured reports for humans and machines.

### JSON report

```bash
worphling check --report-file ./.worphling/worphling-report.json
```

### Markdown report

```bash
worphling report --report-file ./.worphling/worphling-report.md
```

Reports include:

- command used
- source locale
- target locales
- missing / extra / modified counts
- translated key count
- written file count
- detected issues

---

## Exit Codes

| Code | Meaning               |
| ---- | --------------------- |
| `0`  | Success               |
| `1`  | General runtime error |
| `2`  | Config error          |
| `3`  | Validation error      |
| `4`  | Changes detected      |
| `5`  | Provider error        |

---

## Typical Workflows

### Local development

```bash
worphling sync --write
```

### CI validation

```bash
worphling check --ci
```

### Generate a translation report

```bash
worphling report --report-file ./.worphling/worphling-report.md
```

### Translate only specific locales

```bash
worphling sync --locales fa,de --write
```

---

## Recommended Setup

For most teams:

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
        "failOnExtraKeys": false,
        "failOnMissingKeys": true,
        "failOnModifiedSource": false
    },
    "ci": {
        "reportFile": "./.worphling/worphling-report.json"
    }
}
```

For `next-intl` projects:

```json
{
    "plugin": {
        "name": "next-intl"
    }
}
```
