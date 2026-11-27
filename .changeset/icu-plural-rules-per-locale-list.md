---
'@generaltranslation/icu': patch
---

perf(icu): build `Intl.PluralRules` once per locale list and plural type in `formatMessage` instead of once per formatted message, using a cache bounded to 64 entries
