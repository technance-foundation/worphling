---
"@technance/worphling": major
---

Remove CI mode and replace it with a unified `runtime` configuration model.

This release simplifies Worphling by eliminating the concept of "CI mode" and treating reporting and failure behavior as part of general runtime policy.

### Breaking changes

- Removed `ci` configuration entirely
- Removed `ci.mode`
- Removed `--ci` CLI flag
- Removed CI-specific execution behavior (no more implicit non-mutating mode)

### New configuration

Introduce a new `runtime` config section:

```js
runtime: {
  reportFile?: string;
  failOnChanges: boolean;
  failOnWarnings: boolean;
}
```

### Behavior changes

- Reporting and failure logic now applies uniformly (not CI-only)
- CLI flags override runtime config:
    - `--report-file`
    - `--fail-on-changes`
    - `--fail-on-warnings`

- `check` and `report` are always non-mutating (no CI toggle needed)
- `fix`, `sync`, and `translate` require `--write` to mutate files

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

- `ci.mode`
- `--ci`

### Why

- CI is an environment, not a behavior model
- Behavior should be explicit and consistent across environments
- This removes hidden execution differences and simplifies mental model
