---
'@generaltranslation/api': minor
---

Sync the `2026-10-08.v1` contract's file changes. `createFileUploads` returns presigned URLs to PUT files to; an upload then sends `upload: { sha256 }` in place of `content`, which is required for files over 4MB. Source uploads accept `metadata.previewUrl`, the page that shows that version of the file. Translation uploads no longer take `transformFormat`: a translation's `fileFormat` is the format it is saved in, the source's format or a supported conversion (POT to PO). File content reads return `downloadUrl` when `data` is `null` because the file is too large to return inline, and for media files. `createOrgApiKey` creates organization API keys.
