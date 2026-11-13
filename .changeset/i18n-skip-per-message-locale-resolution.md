---
'gt-i18n': patch
---

fix(i18n): stop resolving the request locale again for every message looked up through `getLookupTranslation`, which slowed `gt()` and `m()` on non-default-locale pages
