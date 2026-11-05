---
'@generaltranslation/api': minor
---

`createApiClient` gzips request bodies of 32 KiB or more and sends `Content-Encoding: gzip`, so the server must accept gzip-encoded bodies. If the server rejects the encoding (415, or 400 `invalid_content_encoding`), the client resends the request uncompressed once. Set `compression: false` when a custom `fetch` or proxy must read plain request bodies. `putFileUpload` and `fetchFileDownload` are never compressed.
