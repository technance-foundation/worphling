# @technance/worphling

## 4.0.0

### Major Changes

- [#34](https://github.com/technance-foundation/worphling/pull/34) [`e99e820`](https://github.com/technance-foundation/worphling/commit/e99e8200084880b3c41f11f6a334d7f18816711a) Thanks [@inf1nite-lo0p](https://github.com/inf1nite-lo0p)! - Remove CI mode and replace it with a unified `runtime` configuration model.

  This release simplifies Worphling by removing the concept of CI-specific behavior and treating reporting and failure behavior as part of normal runtime configuration.

  ### Breaking changes

  - Removed the `ci` config section entirely
  - Removed `ci.mode`
  - Removed `ci.reportFile`
  - Removed `ci.failOnChanges`
  - Removed `ci.failOnWarnings`
  - Removed the `--ci` CLI flag
  - Removed CI-specific execution behavior
  - Removed the dedicated `ChangesDetected` exit code

  ### New configuration

  Introduce a `runtime` config section:

  ```ts
  runtime: {
    reportFile?: string;
    failOnChanges: boolean;
    failOnWarnings: boolean;
  }
  ```

  ### Behavior changes

  - Reporting and failure behavior now applies uniformly across environments
  - CLI flags override runtime config:

    - `--report-file`
    - `--fail-on-changes`
    - `--fail-on-warnings`

  - `check` and `report` are always non-mutating
  - `translate`, `fix`, and `sync` only mutate files when `--write` is provided
  - `--dry-run` remains non-mutating
  - `failOnChanges` now returns `ValidationError` instead of a separate changes-specific exit code
  - Validation, warning-based failures, and change-based failures now share a single failure exit code

  ### Exit codes

  Before:

  - `0` -- Success
  - `1` -- General runtime error
  - `2` -- Config error
  - `3` -- Validation error
  - `4` -- Changes detected
  - `5` -- Provider error

  After:

  - `0` -- Success
  - `1` -- General runtime error
  - `2` -- Config error
  - `3` -- Validation error
  - `4` -- Provider error

  ### Migration

  Before:

  ```js
  ci: {
    mode: true,
    reportFile: "./artifacts/worphling-report.json",
    failOnChanges: true,
    failOnWarnings: true,
  }
  ```

  After:

  ```js
  runtime: {
    reportFile: "./artifacts/worphling-report.json",
    failOnChanges: true,
    failOnWarnings: true,
  }
  ```

  Remove any usage of:

  - `ci`
  - `ci.mode`
  - `ci.reportFile`
  - `ci.failOnChanges`
  - `ci.failOnWarnings`
  - `--ci`

  ### Why

  - CI is an environment, not a behavior model
  - Runtime behavior should be explicit and consistent everywhere
  - Reporting and failure policies belong to runtime configuration
  - This removes hidden execution differences and simplifies the mental model
  - A single validation-style failure code is easier to reason about in automation

## 3.0.0

### Major Changes

- [`8a1a580`](https://github.com/technance-foundation/worphling/commit/8a1a58002f8b9b7a50c112261fa8c94978b000cb) Thanks [@inf1nite-lo0p](https://github.com/inf1nite-lo0p)! - Release Worphling v3 with a redesigned runtime, validation pipeline, and CLI workflow.

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

## 2.0.0

### Major Changes

- [#27](https://github.com/technance-foundation/worphling/pull/27) [`68614b6`](https://github.com/technance-foundation/worphling/commit/68614b69cb39cc09b74abe4ac09f566725efa891) Thanks [@mowhcen](https://github.com/mowhcen)! - Update dependencies and switch to latest GPT model for `Translator`

## 1.3.1

### Patch Changes

- Fix package not removing extra keys in targets file

## 1.3.0

### Minor Changes

- Fix package not working in Windows setup

## 1.2.0

### Minor Changes

- Upgrade all installed dependency packages to their latest versions.

## 1.1.1

### Patch Changes

- Fixed issue with modified keys not being detected or translated in target language files
- Implemented snapshot-based tracking to properly identify when source text has been changed
- Modified key detection is now enabled by default for better user experience

## 1.1.0

### Minor Changes

- Added optional automatic alphabetical sorting of keys (recursive) for all output JSON files, including the source language file. Enable this behavior via the `--with-sorting` flag.

## 1.0.2

### Patch Changes

- Fixed a bug with incorrect prompt examples being sent to ChatGPT resulting in poor translation quality.

## 1.0.1

### Patch Changes

- Updated the configuration file resolution logic to support multiple file extensions (.mjs, .js) dynamically.

## 1.0.0

### Major Changes

- Initial release
