---
'generaltranslation': patch
'gt': patch
'gt-sanity': patch
---

Use the instance's existing custom mapping when validating partial `setConfig()` locale updates, unless the update supplies a replacement mapping.

Canonicalize nested source-file locales in `uploadTranslations()` before sending them to GT services, alongside the top-level source locale and translation locales.

Apply the same locale conversion in the CLI and Sanity API adapters: resolve custom aliases, then standardize language-code spelling for upload, download, enqueue, file-query, and project-setup requests. Preserve canonicalization for CLI project creation and user-edit requests and Sanity single-file downloads. Lowercase configured spellings and lowercase mapping targets such as `en-us` are sent as `en-US`.
