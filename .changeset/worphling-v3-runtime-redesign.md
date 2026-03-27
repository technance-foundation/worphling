---
"@technance/worphling": major
---

Release Worphling v3 with a redesigned runtime, validation pipeline, and CLI workflow.

## What's new

- Introduce command-based CLI flow with `help`, `check`, `translate`, `fix`, `sync`, and `report`
- Add structured execution planning for missing, modified, and extra translation keys
- Add validation engine for:
    - placeholder preservation
    - ICU structure preservation
    - HTML-like/rich-text tag preservation
- Add plugin registry with `none` and `next-intl` plugins
- Add provider factory and provider abstraction with OpenAI-backed translation execution
- Add translation batching, bounded concurrency, retries, and deterministic batch merging
- Add optional translation context files for provider prompt enrichment
- Add CI-oriented reporting with JSON and Markdown report output
- Add structured run reports with issue summaries and machine-readable metadata
- Add richer exit codes for config errors, validation failures, detected changes, and provider failures
- Add improved logging with leveled console output and request diagnostics
- Persist OpenAI request payloads to debug artifacts for easier troubleshooting
- Add locale filtering via `--locales`
- Add `--write`, `--dry-run`, `--ci`, `--report-file`, `--report-format`, `--fail-on-changes`, and `--fail-on-warnings`

## Internal improvements

- Replace the previous app flow with a more modular architecture built around:
    - `LocaleStructure`
    - `LocaleDiffCalculator`
    - `ValidationEngine`
    - `RunPlanner`
    - `RunReporter`
    - `TranslationExecutor`
    - repository-based filesystem access
- Improve config loading with stronger validation, normalization, and defaults
- Replace ad hoc plugin handling with a dedicated translation plugin registry
- Replace the old flat translator flow with provider-based translation execution
- Improve snapshot handling and baseline management for modified source detection
- Improve locale file writing with configurable formatting options
- Expand domain-specific error types for clearer failure handling

## Breaking changes

- Replace the old CLI flags-only workflow with command-based usage
- Replace the previous config shape with the new v3 config structure:
    - `sourceLocale`
    - `localesDir`
    - `filePattern`
    - `provider`
    - `plugin`
    - `snapshot`
    - `output`
    - `validation`
    - `translation`
    - `ci`
- Remove the old `service` and `source` config layout
- Remove legacy flags such as `--try-exact-length` and `--with-sorting` in favor of config-driven behavior and the new command flow
- Change snapshot storage format to include `sourceLocale` and flattened `entries`
- Change runtime behavior so provider initialization is lazy and only occurs when translation work is required
