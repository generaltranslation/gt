---
'gt-sanity': minor
---

Preserve human-edited translations across source changes. Before a translation run uploads a new source revision, gt-sanity now sends the translations Sanity already holds back to General Translation as the stored translation for the source version it has, so content whose source did not change keeps its existing wording instead of being regenerated. Translated documents (via `translation.metadata`, preferring drafts) and internationalized-array locale values are both covered. Previously every translation run discarded manual edits.

Existing translations can also be uploaded on their own via the "Upload Existing" action, without enqueueing a translation.

Adds a "Retranslate from scratch" option to the Translate All dialog for deliberately regenerating translations — the plugin previously had no way to force a retranslation — and a `preserveExistingTranslations: false` escape hatch to restore the old behavior.
