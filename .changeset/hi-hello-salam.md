---
"@technance/worphling": patch
---

Relax validation for semantically equivalent ICU and rich-text translations, and strengthen OpenAI translation prompting/examples.

### What changed

- Relaxed ICU validation to compare semantic structure instead of strict positional ordering
- Allowed placeholder reordering across languages when the same placeholders are preserved
- Allowed rich-text tag reordering when the same tags and open/close counts are preserved
- Allowed plural messages to include extra locale-specific target branches
- Kept strict validation for:
    - removed required ICU branches
    - renamed or removed placeholders
    - hardcoded placeholder values
    - removed or renamed tags
    - broken ICU syntax

### Prompting improvements

- Strengthened OpenAI system prompt to explicitly forbid:
    - omitting keys
    - inventing placeholders
    - removing placeholders
    - hardcoding placeholder values
    - renaming or removing tags
    - flattening ICU structures into plain text

- Added richer translation examples covering:
    - placeholder movement
    - select/plural ICU structures
    - extra locale-specific plural branches
    - rich-text tag movement
    - select-based trade messages

### Tests

- Added coverage for real-world cases that previously produced false positives
- Added regression tests for:
    - placeholder reordering
    - plural branch expansion in target locales
    - tag reordering
    - placeholder hardcoding
    - removed select/plural structure
    - required branch removal

This makes validation less noisy for natural translations while keeping the important structural guarantees intact.
