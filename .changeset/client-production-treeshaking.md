---
'gt-react': minor
'gt-i18n': minor
'generaltranslation': patch
'@generaltranslation/format': patch
---

Production client bundles no longer include the i18nCache, the I18nStore, dev hot reload or the ICU message parser:

- In production, `<T>`, `useGT()`, `useMessages()`, `t` and `m` read only the translations snapshot. Dev hot reload, missing-translation handling and the I18nStore are development-only.
- `initializeGTSPA()` loads the locale's translations into a global snapshot in production and creates no i18nCache or I18nStore. Chunk translations add arriving files to that snapshot. Call `initializeGTSPA()` once per page load.
- Client providers create the I18nStore only in development. The gt-react and gt-next client entries create no i18nCache in production, because lookups read the provider's snapshot. Servers and gt-react-native still create one. gt-tanstack-start's client keeps one, because its loaders run in the browser.
- gt-next's client entry imports gt-react through `gt-react/client-entry`, so Turbopack leaves out gt-react's SPA setup.
- `gt-i18n/internal`: `I18nConfig.getTranslationRuntime()` is replaced by `createGTRuntime()` and `getTranslationRuntimeParams()`, so I18nConfig no longer imports the runtime translation client. `getVersionId()` reads `_versionId` from I18nConfig, and `I18nCache.getVersionId()` is removed. `createGT()` and `createMessages()` require `lookupTranslation`; pass `lookupCachedTranslation` to read the I18nCache.
- `generaltranslation/internal` and `@generaltranslation/format/internal` export `LocaleIntl`, a `GTIntl` without `formatMessage()`, so `I18nConfig` keeps the ICU parser out of bundles that format no ICU strings. `GTIntl` is unchanged.
