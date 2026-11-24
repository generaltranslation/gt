---
'gt-react': minor
'gt-tanstack-start': minor
'gt-i18n': minor
'generaltranslation': patch
'@generaltranslation/format': patch
'@generaltranslation/icu': patch
---

Production client bundles no longer include the i18nCache, the I18nStore, dev hot reload or the ICU message parser:

- In production, `<T>`, `useGT()`, `useMessages()`, `t` and `m` read only the translations snapshot. Dev hot reload, missing-translation handling and the I18nStore are development-only.
- `initializeGTSPA()` loads the locale's translations into a global snapshot in production and creates no i18nCache or I18nStore. Chunk translations add arriving files to that snapshot. Call `initializeGTSPA()` once per page load.
- Client providers create the I18nStore only in development. The gt-react, gt-next and gt-tanstack-start client entries create no i18nCache in production; servers and gt-react-native still create one.
- gt-tanstack-start's browser `getGT()` and `getMessages()` read a translations snapshot in production, filled from the server's router state or loaded once per locale. Its `/compat` entry creates the i18nCache that dictionary lookups read.
- gt-next's client entry imports gt-react through `gt-react/client-entry`, so Turbopack leaves out gt-react's SPA setup.
- gt-i18n, generaltranslation, `@generaltranslation/format` and `@generaltranslation/icu` publish their ES modules unbundled, one file per source module, so Turbopack leaves out modules an app never imports. Their CommonJS builds are unchanged.
- `gt-i18n/internal`: `I18nConfig.getTranslationRuntime()` is replaced by `createGTRuntime()` and `getTranslationRuntimeParams()`, so I18nConfig no longer imports the runtime translation client. `I18nConfig.isDevHotReloadEnabled()` is replaced by `isDevHotReloadEnabled(config)`. `getVersionId()` reads `_versionId` from I18nConfig, and `I18nCache.getVersionId()` is removed. `createGT()` and `createMessages()` require `lookupTranslation`; pass `lookupCachedTranslation` to read the I18nCache.
- `generaltranslation/internal` and `@generaltranslation/format/internal` export `LocaleIntl`, a `GTIntl` without `formatMessage()`, so `I18nConfig` keeps the ICU parser out of bundles that format no ICU strings. `GTIntl` is unchanged.
