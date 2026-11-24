---
'gt-i18n': patch
---

A locale whose translations fail to load renders its content as source content. In production, `getLookupTranslation()` returned the source as if it were the translation, so its plural branches were picked by the rules of the reader's locale: with English source shown in `fr`, a count of 0 rendered `0 file` where an empty catalog renders `0 files`. Every lookup is now a miss, as `lookupTranslationWithFallback()` already reports one.
