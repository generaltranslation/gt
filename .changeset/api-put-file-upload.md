---
'@generaltranslation/api': minor
---

`putFileUpload(upload, bytes, options?)` PUTs a file's bytes to a presigned URL from `createFileUploads`, with no API credentials. It takes the client's `fetch` and `retryPolicy`, and the whole PUT, retries included, times out when the URL expires.
