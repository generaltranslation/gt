---
'@generaltranslation/supported-locales': patch
---

Every listed locale now resolves to itself. `el-EL`, which is not a valid tag, is listed as `el-GR`, and `getSupportedLocale('el-EL')` returns `el-GR`. `getSupportedLocale` returns a listed legacy tag for its standardized form, so `cnr` and `sr-ME` resolve to `cnr` instead of `sr`, and `tl` stays `tl`.
