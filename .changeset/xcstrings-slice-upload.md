---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': minor
---

Add Apple `.xcstrings` catalog upload support to the CLI. An `.xcstrings` catalog holds every locale in one file; on upload the CLI extracts a source-only slice (only the catalog's `sourceLanguage` localization per entry) and uploads that as the source document. The slice is serialized with a pinned byte layout and hashed into its `versionId`, so an unchanged catalog re-slices byte-identically and does not re-upload. Configure it under `files.xcstrings` in `gt.config.json`; patterns without `[locale]` are expected because the catalog is shared across locales.
