---
'@generaltranslation/api': minor
---

Sync the `2026-10-08.v1` contract: every route that carries file content takes exactly one of base64 `content` or `upload: { sha256 }`. `overwriteTranslations` takes `translations` entries with `content` or `upload`, in place of `diffs` with `localContent` and `diff`. `createAssetUploads` returns presigned URLs to PUT fonts of up to 20MB to, answering as `createFileUploads` does, and `upsertAssets` then takes `upload` in place of `content`. `createFileUploads` needs `fileFormat` only for PNG, JPEG and MP4. Content that is empty or not base64 fails its own font or translation. `putFileUpload` takes `timeoutMs`, which ends the PUT when it is sooner than the URL's expiry.
