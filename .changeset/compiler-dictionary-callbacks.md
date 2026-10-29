---
'@generaltranslation/compiler': patch
---

Stop tracking `useTranslations()` and `getTranslations()` as translation callbacks. The tracking only ran a validation that never reported anything, so output is unchanged; the dictionary API now lives in `/compat` entries.
