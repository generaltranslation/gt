---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': patch
---

`gt download` saves translated media over 20MB, which the API returns as `data: null` and a signed `downloadUrl`, instead of reporting it as failed. It streams the file to disk through a temporary `.part` file, so a download that is cut off leaves the previous file in place, and requests the file again if the download did not complete, for example after the URL expired.

`project.fetchFileDownload(downloadUrl)` in `generaltranslation` opens such a URL and returns the file as a stream, so it can be saved without holding it in memory. `getFileContent()` and `queryFilesContent()` return these results as the API sends them. `fetchFileDownload(downloadUrl)` in `@generaltranslation/api` is the underlying request, sent without API credentials.
