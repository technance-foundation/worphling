# Validation Checklist

Use this checklist before applying any PR comment.

## Decide Validity

Mark each comment as one of:

- `valid`: technically correct, in-scope, and still applies to current HEAD.
- `invalid`: incorrect claim, unsafe recommendation, or contradicts repo conventions.
- `already_fixed`: issue is no longer present.
- `out_of_scope`: unrelated to the PR scope.
- `needs_clarification`: ambiguous ask or missing acceptance criteria.

## Validate AI/Bot Comments

For bot comments (for example CodeRabbit, Copilot), process in this order:

1. Read any embedded "Prompt for AI Agents" block, and the full review body for nitpicks and "outside diff range" findings.
2. Verify each suggested file/line exists on current HEAD.
3. Reproduce or reason about the claimed issue.
4. Apply only changes that improve correctness/safety/maintainability.
5. Reject suggestions that conflict with local conventions, including:
   - Replacing Biome output with Prettier/ESLint style.
   - Bypassing Changesets by hand-editing `package.json` versions or `CHANGELOG.md`.
   - Switching away from pnpm commands.
   - Changing `ValidationEngine` issue semantics (types, severities, overlap between `invalid-icu` and `invalid-placeholder`/`invalid-tag`) as a side effect; existing specs pin that behavior and CI reports depend on it.
   - Loosening the OpenAI system prompt's guardrails without a concrete failing translation.

## Validate Human Comments

1. Identify intent (bug risk, style, scope, product behavior).
2. Confirm current behavior in code.
3. Validate side effects and regressions.
4. Prefer the reviewer's intent over literal wording when they differ.

## Evidence Requirements

Before marking a comment `valid`, collect at least one:

- file+line proof from current code
- failing check / warning / linter output
- reproducible behavior path (a spec that fails before the fix is best)

## Implementation Rules

- Batch related fixes together.
- Keep unrelated cleanups out of the patch.
- Run the narrowest check that still proves the fix:
  - `pnpm --filter @technance/worphling typecheck` for `packages/worphling/src`
  - `pnpm --filter @technance/worphling exec vitest run tests/unit/<file>.spec.ts` for a targeted spec
  - `pnpm run check && pnpm run test` when the build, exports, or CLI behavior are touched
- Format/lint with Biome: `pnpm run format:fix` and `pnpm run lint:fix` (do not run Prettier/ESLint directly).
- If the fix changes the public surface of `@technance/worphling` (exports, types, config schema, CLI flags, prompt), add or update a changeset and pick the correct bump (`patch`/`minor`/`major`).
- For this skill, create one local commit per resolved `valid` comment. A changeset change goes in the **same** commit as the code change it describes.
- Write commit messages in the repo's style: imperative, capitalized, ≤72 chars, no Conventional Commit prefix, backticked identifiers.
- Do not push as part of this workflow.

## Quick Sanity Checks Before Committing

- `git diff --staged --stat` shows only files for the current comment.
- If `src/index.ts`, `src/types.ts`, the config schema, or CLI flags changed, a `.changeset/*.md` change is staged.
- Typecheck of the package passes.
- `pnpm run format` and `pnpm run lint` pass for the staged files.

## Suggested Status Summary Format

```text
Addressed:
- <comment link or reviewer>: <what changed> (<file path>) | commit <sha> | checks: <commands run> | changeset: <patch|minor|major|none>

Not Addressed:
- <comment link or reviewer>: <reason: invalid/already_fixed/out_of_scope> | draft reply: <one line>

Needs Clarification:
- <comment link or reviewer>: <specific question>
```
