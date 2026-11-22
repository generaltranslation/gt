---
'gt-i18n': patch
---

fix(i18n): outside development, cache a failed translation or dictionary load as empty for the cache TTL, so a locale with no translations file is fetched and logged once instead of on every lookup
