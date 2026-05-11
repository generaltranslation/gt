---
"gt-i18n": patch
---

Prevent callers from mutating internal translation caches through `getInternalCache()` and start locale cache TTLs after async loads complete.
