---
'generaltranslation': patch
---

Keep every request within the API's limits. Every batched call splits its requests at the 4MB body limit as well as by item count. `uploadSourceFiles()` and `uploadTranslations()` send content by reference only when no request holds it inline, and split their requests so none names more than 150MB of uploaded bytes. A source whose translations exceed that goes with each part of them; a source and one translation that together pass 150MB still go in one request. `uploadTranslations()` throws an `ApiError` with `invalid_request`, before sending anything, when a file and locale are named twice in one call.
