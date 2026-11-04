---
'gt-i18n': minor
'gt-next': minor
---

Skip loading translations for locales embedded at build time. `I18nCache` accepts an experimental `inlinedLocales` option and never calls `loadTranslations` for those locales. gt-next sets it from `experimentalCompilerOptions.inlineTranslations` in production builds with the babel or SWC compiler, for locales that have translations to embed, so GTProvider no longer ships those locales' translations to the client.
