---
'gt-i18n': major
---

Remove the remaining backward compatibility:

- `TranslationMetadata` (and `RuntimeTranslationOptions`) drop the deprecated `$_source`.
- `runtimeTranslation.metadata` accepts only `sourceLocale` and `modelProvider`.
- `runtimeTranslation.timeout: 0` is a zero timeout; omit `timeout` for the default.
- The re-exported `GTConfig` drops `devApiKey`, `files.gt.includeSourceCodeContext`, and `parsingFlags.legacyGtReactImportSource`. gt-i18n's own `devApiKey` option is unchanged and is used as the runtime API key when neither `apiKey` nor `GT_API_KEY` is set.
- Runtime translation uses `generaltranslation` 10's `GTRuntime`, created per request from the configured `projectId` and API key. gt-i18n reads `GT_API_KEY` itself, so the key is still `apiKey`, then `GT_API_KEY`, then `devApiKey`. Without a `projectId` or an API key, each runtime translation request rejects with gt-i18n's configuration guidance; a `projectId` set only through `GT_PROJECT_ID` is no longer picked up, so pass `projectId`.
- `gt-i18n/internal`: `getI18nConfig()` is a `GTIntl` from `@generaltranslation/format` instead of a `LocaleConfig`, so its helpers take the target locale in the options object: `requiresTranslation(locale)` → `requiresTranslation({ locale })`, `determineLocale(candidates, approved)` → `determineLocale(candidates, { approvedLocales: approved })`, `formatNum(n, locale, options)` → `formatNum(n, { ...options, locale })`. `getGTClass()` → `getTranslationRuntime()`, which returns a `GTRuntime` only when a `projectId` and an API key resolve.
