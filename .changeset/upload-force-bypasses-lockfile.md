---
'gt': patch
---

`gt upload --force` now re-uploads translation files even when gt-lock.json marks them unchanged, overwriting existing remote translations. Previously the flag was accepted but the lockfile skip ignored it. The `--force` help text now states the overwrite behavior.
