---
'@generaltranslation/compiler': minor
---

Add the experimental `experimentalStaticLocale` option (or the `GT_STATIC_LOCALE` environment variable) for per-locale builds of single-page apps. Server-rendered apps, including Next.js, are not supported. When set, the translations embedded with `files.gt.inlineTranslations` keep only that locale's strings, whether inlined at call sites or emitted as message modules, so each build ships one language. Physical message modules of a per-locale build go to `<modulesDir>/<locale>`. A source locale, or a locale that is not embedded, embeds no translations.
