---
'gt': minor
---

`gt generate` has two new flags for projects that run their own translation pipeline:

- `--source-only` writes only the source locale file. Target locale files are left as they are, instead of being filled with untranslated source entries.
- `--metadata <path>` also writes a JSON file with each entry's `dataFormat`, `id`, `context`, `maxChars`, `requiresReview` and `filePaths`, keyed by the same hashes as the source file.
