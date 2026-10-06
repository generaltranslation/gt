---
'@generaltranslation/api': patch
---

`ApiError` no longer uses an HTML error page as its message; it falls back to the response status text, or to the HTTP status code when there is none.
