---
'generaltranslation': patch
---

Runtime translation errors with an empty or non-standard body now report the response status text, or the HTTP status code when there is none, instead of "Unknown error".
