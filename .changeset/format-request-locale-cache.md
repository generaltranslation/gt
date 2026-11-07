---
'@generaltranslation/format': patch
'gt-i18n': patch
---

Bound memory and work for request-controlled locale strings:

- `isValidLocale` and `determineLocale` no longer add an `Intl` cache entry for every distinct locale string they validate, so Accept-Language headers, cookies, and URL segments cannot grow the cache without bound. Validity results are unchanged.
- `parseAcceptLanguage` reads at most the first 32 entries of an Accept-Language header.
