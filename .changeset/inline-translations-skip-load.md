---
'gt-next': minor
---

Skip loading translations for locales embedded at build time. In production builds with the babel or SWC compiler, gt-next passes the `experimentalCompilerOptions.inlineTranslations` locales that have translations to embed to the `I18nCache` as `inlinedLocales`, so GTProvider no longer ships those locales' translations to the client.
