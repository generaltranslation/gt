---
'@generaltranslation/api': minor
'generaltranslation': patch
'gt': patch
---

Source files over the upload route's inline limit (20MB, or more than a request can carry) are uploaded straight to storage and sent by reference, so `gt stage` and `gt translate` no longer fail with 413 on large files. `@generaltranslation/api` adds `createFileUploads`, `putFileUpload`, and `uploadSourceFileReferences`.
