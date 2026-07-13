---
'gt-i18n': patch
'gt-node': patch
'gt-react': patch
---

Add `parseLocale(request)` to resolve server-rendered React locales from the configured cookie, the `Accept-Language` header, or the default locale.

Share cookie and `Accept-Language` parsing across the framework packages.
