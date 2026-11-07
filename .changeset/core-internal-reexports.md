---
'generaltranslation': patch
---

Internal modules import format and API symbols from `@generaltranslation/format` and `@generaltranslation/api` instead of through pass-through modules or the package's own entries. The public entries export the same names; no public API change.
