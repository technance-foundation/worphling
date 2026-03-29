---
"@technance/worphling": major
---

Remove CI mode and replace it with a unified `runtime` configuration model.

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
