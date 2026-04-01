---
"@technance/worphling": minor
---

Add structured run output reporting and decouple planning from filesystem concerns.

- Introduce `RunOutputSummary` to describe written locale files and snapshot output
- Include `outputs` in `RunReport` for CI and reporting use cases
- Move output computation from `RunPlanner` to `App` to keep planner domain-pure
- Add `collectLocalesToWrite` helper to `RunPlanner`
- Simplify `RunReporter` summary calculations and markdown output
- Centralize snapshot write decision using `shouldWriteSnapshot`
