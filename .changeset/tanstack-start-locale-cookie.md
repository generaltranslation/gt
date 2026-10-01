---
'gt-tanstack-start': patch
---

Only send the locale `Set-Cookie` header when the request's locale cookie is missing or differs from the resolved locale, so responses for returning visitors stay cacheable.
