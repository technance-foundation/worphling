---
"@technance/worphling": patch
---

Improve OpenAI translation prompt reliability and stop writing debug request artifacts.

### What changed

- strengthened the OpenAI system prompt to better preserve ICU structure
- added explicit guidance to preserve plural `#` tokens in every matching branch
- added stronger per-key verification instructions before the model responds
- clarified that source text should not remain untranslated unless it is already naturally correct
- removed writing outbound OpenAI request payloads into local `artifacts/` files

### Why

This improves translation correctness for structured ICU messages, especially plural branches where `#` must be preserved exactly, and avoids generating provider request artifact files during normal runs.
