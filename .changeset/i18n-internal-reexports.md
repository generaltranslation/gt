---
'gt-i18n': patch
---

Remove internal pass-through modules: the dictionary types and `GTConfig` are imported from their defining modules. The public entries export the same names; no public API change.
