---
"gt-i18n": patch
---

Fix the shipped `gt-i18n/internal` declarations referencing `InterpolationOptions` without declaring it (`stripInternal` removed the `@internal`-tagged alias but kept the reference, breaking consumers compiling with `skipLibCheck: false`). The type now lives in the shared options module, resolves in the emitted declarations, and is nameable from `gt-i18n/internal/types`.
