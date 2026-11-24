---
'gt': minor
---

`gt generate` has two new flags for projects that run their own translation pipeline:

- `--source-only` writes only the source locale file. Target locale files are left as they are, instead of being filled with untranslated source entries.
- `--metadata [path]` also writes each entry's metadata, keyed by the same hashes as the source file. By default it goes in a companion file next to the source file (`en.json` → `en.metadata.json`), the same layout `gt translate` reads for keyed JSON files; pass a path to write it elsewhere. Each entry has `context`, `maxChars` and `sourceCode` as in companion metadata files, plus `dataFormat`, `id`, `requiresReview` and `filePaths`. Entries that share a hash keep the first `id` and list every file path.

Both flags need `files.gt.output`, and `--metadata` refuses a path that is one of the locale files. Dictionary entries now carry their dictionary file in `filePaths`.
