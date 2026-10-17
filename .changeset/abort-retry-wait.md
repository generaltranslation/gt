---
'@generaltranslation/api': patch
'generaltranslation': patch
---

Aborting a request's signal now also ends the wait before a rate-limit or server-error retry, so the request fails right away with the abort reason. The API adapter's `queryFileData` takes an optional abort signal.
