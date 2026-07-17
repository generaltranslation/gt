---
'gt': patch
---

`gt translate --force` (and `--force-download`) now uploads local translation edits to the platform before retranslating, so local manual edits can be recovered instead of being silently destroyed. If that upload fails, the force run aborts before anything destructive happens. Force runs also print a warning that existing translations, including manual edits, will be overwritten.
