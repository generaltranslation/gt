---
"gt": patch
---

`gt translate` no longer saves local edits to translated output by default. Saving local edits is now opt-in via `--save-local` or `options.saveLocal: true` in `gt.config.json`, so running the CLI locally does not overwrite production translations.
