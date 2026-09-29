---
"@technance/worphling": minor
---

Export a filesystem-free translation API and add inline translation context.

- Export `translateEntries` to translate flat ICU entries without touching the filesystem, returning `{ translations, issues }`
- Make the package root a side-effect-free library entry (`dist/index.mjs`) and move the CLI bin to `dist/cli.mjs`
- Export the Worphling error classes from the package root
- Add inline `translation.context` config option, merged after `translation.contextFile` content
