---
'gt-sanity': minor
---

Add opt-in preservation of human-edited translations. With the new **Save local edits** toggle enabled, the translations Sanity already holds are uploaded to General Translation before a translation run, so content whose source text did not change keeps its existing wording instead of being regenerated. Translated documents (via `translation.metadata`, preferring drafts) and internationalized-array locale values are both covered.

The toggle is off by default and shows an explanation before it can be enabled — turning it on means local content overwrites whatever General Translation holds for that source version, including a completed translation that has not been imported yet. Its initial state can be set with the `preserveExistingTranslations` plugin option.

Also adds a **Save Local Edits** action, which uploads the translations already in Sanity (seeding source files as needed) without enqueueing a translation, and a **Retranslate from scratch** option in the Translate All dialog for deliberately regenerating translations — the plugin previously had no way to force a retranslation.
