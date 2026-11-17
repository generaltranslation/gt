---
'gt-react': minor
---

Add the experimental `gt-react/static-locale` server entry for per-locale builds of single-page apps. Its one function, `negotiateLocale()`, picks a request's locale like gt-next's middleware (locale cookie, then `Accept-Language`, then the default locale) from a Web `Request`, a Node request, or either one's headers, and returns a configured locale that names the build to serve. The entry does not import React.
