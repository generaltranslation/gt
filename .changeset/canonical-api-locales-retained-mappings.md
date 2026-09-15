---
'generaltranslation': patch
'gt': patch
'gt-sanity': patch
---

Use the instance's existing custom mapping when validating partial `setConfig()` locale updates, unless the update supplies a replacement mapping.

Canonicalize nested source-file locales in `uploadTranslations()` before sending them to GT services, including lowercase configured spellings and custom aliases.

Apply canonical locale spelling consistently to outgoing CLI and Sanity API requests, including upload, download, query, and project setup payloads.
