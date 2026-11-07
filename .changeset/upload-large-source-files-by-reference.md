---
'@generaltranslation/api': minor
'generaltranslation': patch
'gt': patch
---

Source files over the upload route's inline limit (20MB, or more than a request can carry with their `formatMetadata`) are uploaded straight to storage, content and `formatMetadata` both, and sent by reference, so `gt stage` and `gt translate` no longer fail with 413 on large files or large source-code context. `@generaltranslation/api` adds `createFileUploads`, `putFileUpload`, and `uploadSourceFileReferences`.
