---
'@generaltranslation/api': minor
'generaltranslation': patch
---

`getFileContent()` and `queryFilesContent()` read a file the API returns only through a signed `downloadUrl` (translated media over 20MB) and return it in `data`, like an inline file, instead of `data: null`. `gt download` saves those files instead of reporting them as failed.

Selectors that share a file download it once, and a URL that expires while its download waits in the queue is read again once.

`fetchFileDownload(downloadUrl, options?)` in `@generaltranslation/api` reads such a URL's bytes without API credentials. Its timeout and retries cover the whole body, not only the response headers.
