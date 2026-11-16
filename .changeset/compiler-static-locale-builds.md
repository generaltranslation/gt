---
'@generaltranslation/compiler': minor
---

Add the experimental `experimentalStaticLocale` option (or the `GT_STATIC_LOCALE` environment variable) for per-locale builds. When set, the translations embedded with `files.gt.inlineTranslations` keep only that locale's strings, so each build ships one language. A source locale, or a locale that is not embedded, embeds no translations.
