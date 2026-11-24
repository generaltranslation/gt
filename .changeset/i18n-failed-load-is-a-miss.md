---
'gt-i18n': patch
---

A locale whose translations fail to load renders its content as source content. In production, `getLookupTranslation()` returned the source as if it were the translation, so it formatted in the reader's locale and picked its plural branches by that locale's rules: with English source shown in `fr`, a count of 0 rendered `0 file` where an empty catalog renders `0 files`. A lookup in that locale is now a miss, as `lookupTranslationWithFallback()` already reports one. A lookup that names another locale in `$locale` resolves as before.
