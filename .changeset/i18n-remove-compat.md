---
'gt-i18n': major
---

Remove the remaining backward compatibility:

- `TranslationMetadata` (and `RuntimeTranslationOptions`) drop the deprecated `$_source`.
- `runtimeTranslation.metadata` accepts only `sourceLocale` and `modelProvider`.
- `runtimeTranslation.timeout: 0` is a zero timeout; omit `timeout` for the default.
- The re-exported `GTConfig` drops `devApiKey`, `files.gt.includeSourceCodeContext`, and `parsingFlags.legacyGtReactImportSource`. gt-i18n's own `devApiKey` option is unchanged and is used as the runtime API key when neither `apiKey` nor `GT_API_KEY` is set.
