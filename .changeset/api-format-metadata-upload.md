---
'@generaltranslation/api': minor
---

Sync the 2026-10-08.v1 contract: a source upload's `formatMetadata` is `{ content }` with the metadata, or `{ upload: { sha256 } }` for metadata PUT through `createFileUploads`; translation uploads no longer take the source's `formatMetadata`. Adds `updateFiles` for updating source files and translations, and raises the uploaded non-media file limit to 150MB.
