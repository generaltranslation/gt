---
'gt-sanity': minor
---

Preserve human-edited translations by uploading existing Sanity translations to General Translation. Translated documents (via translation.metadata, preferring drafts) and internationalized-array locale values are serialized and upserted as translations for the uploaded source version. Available as an "Upload Existing" bulk action in the Translations tool, an "Upload Existing Translations" button in the per-document view, and a "Preserve existing translations" toggle (on by default) that runs the upload before Translate enqueues new jobs.
