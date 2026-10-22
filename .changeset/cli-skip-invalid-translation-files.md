---
'gt': patch
---

`gt upload` now skips unparsable JSON and YAML translation files with a warning, as it already does for source files, instead of sending them and losing the whole translation batch.
