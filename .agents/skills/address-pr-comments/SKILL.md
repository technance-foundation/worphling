---
name: address-pr-comments
description: Address GitHub pull request review comments using gh CLI. Use when asked to process PR feedback, especially mixed human + AI bot reviews (for example CodeRabbit prompts), triage validity, apply fixes, and prepare concise responses with evidence.
---

# Address PR Comments

## Overview

Collect PR feedback with `gh`, classify AI/bot vs human comments, validate each comment against current code, implement only valid changes, and summarize what was addressed vs rejected.

## Project Context

This repo is a pnpm workspace (no Turborepo). Treat the following as defaults when applying fixes:

- Package manager: **pnpm** (never `npm`/`yarn`).
- Formatter/linter: **Biome** via `pnpm run format` / `pnpm run lint` (never Prettier/ESLint CLIs).
- Workspaces that usually receive comments:
  - `@technance/worphling` → `packages/worphling` (publishable CLI + library; source in `src/`, tests in `tests/unit` and `tests/integration`)
  - `@technance/worphling-playground` → `apps/playground` (private E2E sandbox, ignored by Changesets)
- Public surface of `@technance/worphling`: exports from `src/index.ts`, types in `src/types.ts`, the config schema enforced by `src/app/ConfigLoader.ts`, CLI flags in `src/cli/cliSchema.ts`, the `bin`/`exports` in `package.json`, and the translation prompt in `src/providers/OpenAiTranslationProvider.ts`.
- Releases use **Changesets** on `main` only (no pre-release branch). A fix that changes the public surface usually needs a `.changeset/*.md` file. If the PR already carries a changeset, update it instead of adding a second one.
- Commit messages follow the repo history, not Conventional Commits: imperative, capitalized, no trailing period, ≤72 chars, no `feat:`/`fix:` prefixes, code identifiers in backticks. Sample `git log origin/main --pretty=format:"%s" -30` when unsure.

## Workflow

Address PR comments in this order:

1. Resolve target PR.
2. Verify `gh` availability/auth.
3. Collect comments (top-level, reviews, inline).
4. Classify source (AI/bot vs human).
5. Validate each comment before changing code.
6. Apply fixes and run targeted checks.
7. Commit each resolved comment locally (no push).
8. Summarize addressed/rejected items with rationale.

## 1. Resolve PR

If user did not provide a PR number, infer from current branch:

```bash
gh pr view --json number,title,url,baseRefName,headRefName
```

If that fails, ask the user for PR number or URL.

## 2. Verify GH CLI

```bash
gh --version
gh auth status
```

If missing or unauthenticated, stop and report the blocker clearly.

## 3. Collect Feedback

Use the helper script for normalized output:

```bash
python3 .agents/skills/address-pr-comments/scripts/list_comments.py --pr <number> --json
```

The script aggregates:
- Top-level comments
- Review submissions
- Inline review comments from unresolved threads by default (including outdated unresolved threads)
- AI-prompt snippets when present in bot comments

Bot reviews (CodeRabbit especially) put nitpicks and "outside diff range" findings in the **review body**, not in inline threads. Always fetch full bodies once so none are missed:

```bash
python3 .agents/skills/address-pr-comments/scripts/list_comments.py --pr <number> --json --full-body
```

To include resolved inline threads too:

```bash
python3 .agents/skills/address-pr-comments/scripts/list_comments.py --pr <number> --json --include-resolved
```

If a bot review is still in progress (for example the CodeRabbit check is `pending`), say so and process what exists; do not wait indefinitely.

## 4. Classify + Prioritize

Prioritize:
1. Human reviewer blocking concerns
2. High-confidence AI comments with concrete evidence
3. Lint/style/nit comments

Treat bots (CodeRabbit, Copilot, etc.) as advisory. Do not apply suggestions blindly.

## 5. Validate Before Fixing

Use the checklist in `references/validation-checklist.md`.

Mark each comment as one of:
- `valid`
- `invalid`
- `already_fixed`
- `out_of_scope`
- `needs_clarification`

For AI bot comments containing a "Prompt for AI Agents" block, parse and verify each requested change against current files and repo conventions before editing.

## 6. Implement + Verify

Apply fixes one validated comment at a time.

Run the narrowest check that still proves the fix:

```bash
# Package typecheck
pnpm --filter @technance/worphling typecheck

# A single spec file (fast)
pnpm --filter @technance/worphling exec vitest run tests/unit/<file>.spec.ts

# Format + lint (Biome)
pnpm run format:fix
pnpm run lint:fix

# CI gate: format check, lint, build + typecheck, full tests
pnpm run format && pnpm run lint && pnpm run check && pnpm run test
```

`pnpm run test` includes CLI integration tests that build the package, so it is slower than a single spec. The playground E2E job calls OpenAI and needs `OPENAI_API_KEY`; do not run it locally unless a comment is specifically about it.

If the fix changes the public surface of `@technance/worphling` (see Project Context), add or update a changeset (`pnpm changeset`, or edit the PR's existing `.changeset/*.md`). Pick `patch`/`minor`/`major` per the contract change. Never hand-edit versions in `package.json` or `CHANGELOG.md`.

## 7. Commit Each Resolved Comment (No Push)

For every `valid` comment you resolve:

1. Stage only the files needed for that single comment (code + its `.changeset/*.md` if the fix warrants one).
2. Write the commit message in the repo's style (see Project Context).
3. Create exactly one local commit for that resolved comment.
4. Do **not** push.

Rules:
- Do not combine multiple resolved comments into one commit unless technically inseparable.
- If inseparable, note all linked comment URLs in your final report for that commit.
- A changeset change that documents the fix belongs in the **same** commit as the code change it describes — not a separate commit.
- Do not commit comments marked `invalid`, `already_fixed`, `out_of_scope`, or `needs_clarification`.
- Do not reply to, resolve, or dismiss review threads on GitHub unless the user asks; draft the replies in the report instead.

## 8. Report Back

Provide:
- Addressed comments (with file references and commit hashes)
- Rejected comments (with reason), plus a one-line draft reply for each
- Any unclear comments that need reviewer clarification
- Which checks were run and their outcomes
- Whether a changeset was added or updated, and its bump type

## Quick Commands

```bash
# Current branch PR
gh pr view --json number,title,url,baseRefName,headRefName

# Structured comment dump for a specific PR, with full bodies
python3 .agents/skills/address-pr-comments/scripts/list_comments.py --pr 35 --json --full-body

# Include resolved inline threads
python3 .agents/skills/address-pr-comments/scripts/list_comments.py --pr 35 --json --include-resolved

# Scoped verification (preferred)
pnpm --filter @technance/worphling typecheck
pnpm --filter @technance/worphling exec vitest run tests/unit/<file>.spec.ts

# Biome fix-in-place
pnpm run format:fix
pnpm run lint:fix

# Full CI gate
pnpm run format && pnpm run lint && pnpm run check && pnpm run test

# Per-comment local commit workflow (no push)
git add <files-for-one-comment> [.changeset/<name>.md]
git diff --staged --stat
git commit -m "<repo-style subject>"
# DO NOT: git push
```
