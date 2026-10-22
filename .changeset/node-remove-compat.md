---
'gt-node': major
---

Pick up the backward-compatibility removals from generaltranslation and gt-i18n:

- The re-exported `GTConfig` drops `devApiKey`, `files.gt.includeSourceCodeContext` (use `files.gt.parsingFlags.includeSourceCodeContext`), and `parsingFlags.legacyGtReactImportSource`. `initializeGT({ devApiKey })` is unchanged.
- `runtimeTranslation.metadata` accepts only `sourceLocale` and `modelProvider`.
- `runtimeTranslation.timeout: 0` is a zero timeout; omit `timeout` for the default.
- `RuntimeTranslationOptions` drops the deprecated `$_source`.
- `initializeGT()` still reads `GT_PROJECT_ID` and `GT_API_KEY`.
