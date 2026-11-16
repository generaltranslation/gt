---
'gt-react': minor
---

Add the experimental `gt-react/static-locale` server entry for per-locale builds. `negotiateLocale()` picks a request's locale like gt-next's middleware (locale cookie, then `Accept-Language`, then the default locale) from a Web `Request`, Node request headers, or raw header values, and `getStaticLocalePath()` maps it to that locale's build directory. The entry does not import React.
