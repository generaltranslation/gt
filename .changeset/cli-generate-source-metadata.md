---
'gt': minor
---

`gt generate` has two new flags for projects that run their own translation pipeline:

- `--source-only` writes only the source locale file. Target locale files are left as they are, instead of being filled with untranslated source entries.
- `--metadata <path>` also writes a JSON file with each entry's `dataFormat`, `id`, `context`, `maxChars`, `requiresReview` and `filePaths`, keyed by the same hashes as the source file. Entries that share a hash keep the first `id` and list every file path.

Both flags need `files.gt.output`, and `--metadata` refuses a path that is one of the locale files. Dictionary entries now carry their dictionary file in `filePaths`.
