---
'gt-i18n': major
---

Remove the remaining backward compatibility:

- `TranslationMetadata` (and `RuntimeTranslationOptions`) drop the deprecated `$_source`.
- `runtimeTranslation.metadata` accepts only `sourceLocale` and `modelProvider`.
- `runtimeTranslation.timeout: 0` is a zero timeout; omit `timeout` for the default.
- The re-exported `GTConfig` drops `devApiKey`, `files.gt.includeSourceCodeContext`, and `parsingFlags.legacyGtReactImportSource`.
- Runtime translation uses `generaltranslation` 10's `GTRuntime`, created per request from the configured `projectId` and `apiKey`. gt-i18n reads neither `GT_PROJECT_ID` nor `GT_API_KEY`: the framework package reads them once, when it is initialized, and passes them in. Without a `projectId` or an API key, each runtime translation request rejects with gt-i18n's configuration guidance.
- `gt-i18n/internal`: `getI18nConfig()` is a `GTIntl` (the one from `generaltranslation`) instead of a `LocaleConfig`, so its helpers take the target locale in the options object: `requiresTranslation(locale)` → `requiresTranslation({ locale })`, `determineLocale(candidates, approved)` → `determineLocale(candidates)`, `formatNum(n, locale, options)` → `formatNum(n, { ...options, locale })`. `I18nConfig.determineLocale(candidates)` takes no `approvedLocales` and uses the configured locales. `getGTClass()` → `getTranslationRuntime()`, which returns a `GTRuntime` and throws the missing-`projectId` or missing-API-key error otherwise.
