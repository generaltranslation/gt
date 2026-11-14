---
'gt-i18n': patch
---

`parseAcceptLanguage` reads at most the first 32 entries of an Accept-Language header, bounding the work a request-controlled header can cause.
