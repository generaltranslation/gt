---
'gt': minor
---

Add `gt migrate`, which carries translations from the legacy APIs (`<T>`, `gt()`, `msg()` and dictionaries) over to messages rewritten with the `/unstable` tagged templates, so the next `gt translate` does not translate them again.

It reads the legacy translation files and, when present, the legacy source file that `gt generate` wrote. It matches each current message to a legacy one by key, by the hash its legacy form had, or by its source text, renaming variables where needed. It then converts each translation to a message tree, adding any plural categories the locale requires from the translation's `other` branch, and checks it the way the platform checks uploads. The migrated files are written keyed by the new hashes, with the previous files backed up to `.gt/migrate-backup`. When a project ID is configured, the migrated translations are uploaded so `gt translate` only translates what could not be carried over. A partly covered locale is uploaded under a seed version that the real version builds on, so it is never marked complete.

Use `--dry-run` to only report, `--no-upload` to only write files, `--report <file>` for every decision as JSON, `--from` and `--legacy-source` to read legacy files from elsewhere, `--no-fill` to skip adding plural categories, and `--loose` to also match text that differs only in whitespace.
