---
'gt-i18n': patch
---

`I18nCache.updateTranslations()` adds entries to a locale's table in place instead of copying the whole table on every call. Adding 100 files of 300 entries to a locale that holds 30,000 took 939 ms and allocated 508 MB in Node; it now takes 6 ms and allocates 5 MB. Lookups, loaded snapshots and the objects you pass in behave as before.
