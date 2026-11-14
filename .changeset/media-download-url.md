---
'@generaltranslation/api': minor
'generaltranslation': minor
'gt': patch
---

`gt download` saves translated media over 20MB, which the API returns as `data: null` and a signed `downloadUrl`, instead of reporting it as failed. It streams the file to disk through a temporary `.part` file, so a download that is cut off leaves the previous file in place, and requests the file again if the download broke off mid-stream; a download request the API client already retried fails the file. It asks for each file's URL when that file's turn comes, so a long queue of downloads does not outlive the 15-minute URLs: a file the API reports `pending` again is requested again, and any other status fails the file and is reported.

`project.fetchFileDownload(downloadUrl)` in `generaltranslation` opens such a URL and returns the file as a stream, so it can be saved without holding it in memory. `getFileContent()` and `queryFilesContent()` return these results as the API sends them. `fetchFileDownload(downloadUrl)` in `@generaltranslation/api` is the underlying request, sent without API credentials. Reading the stream fails when the download sends nothing for the request timeout (60 seconds), so a stalled download does not hang.
