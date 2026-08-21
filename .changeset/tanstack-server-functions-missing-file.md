---
'gt-tanstack-start': patch
---

Keep server functions alive in development when translation loading fails. Calling `getGT()`, `getMessages()`, or `getTranslations()` on the server for a locale whose translation or dictionary files do not exist yet used to reject and turn the request into an HTTP 500 in development; the request now logs one structured warning and renders untranslated source content instead. A later request retries the loader once translations exist, and production behavior is unchanged.
