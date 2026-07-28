---
'gt-sanity': minor
---

Preserve human-edited translations by uploading existing Sanity translations to General Translation. Translated documents (via translation.metadata, preferring drafts) and internationalized-array locale values are serialized and upserted as translations for the uploaded source version. Translate and Translate All run this automatically before enqueueing (disable with the new `preserveExistingTranslations: false` plugin config option), and the translations can also be uploaded on their own via the "Upload Existing" bulk action in the Translations tool or the "Upload Existing Translations" button in the per-document view.
