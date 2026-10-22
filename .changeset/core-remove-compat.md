---
'generaltranslation': major
---

Remove the remaining backward compatibility:

- `GT`/`GTRuntime` drop `devApiKey` and no longer read `GT_DEV_API_KEY`; pass `apiKey`. `GTRuntime.reverseCustomMapping` is removed.
- `translate()`/`translateMany()` treat `timeout: 0` as a zero timeout; omit `timeout` for the default.
- `TranslateOptions` no longer accepts arbitrary extra keys; `sourceLocale`, `targetLocale` and `modelProvider` remain. Only `modelProvider` is sent in request metadata.
- `uploadTranslations(files, options)` takes only `{ timeout }`: no `sourceLocale` and no missing-source-locale error. Upload options drop `modelProvider`.
- `hashSource` no longer reads `id`; IDs are metadata only.
- `GTConfig` drops `devApiKey`, `files.gt.includeSourceCodeContext` (use `files.gt.parsingFlags.includeSourceCodeContext`), and `parsingFlags.legacyGtReactImportSource`.
- `generaltranslation/internal` drops `createDiagnosticMessage`, `formatDiagnosticErrorDetails`, `DiagnosticMessageInput`, `DiagnosticSeverity` (use `generaltranslation/diagnostics`), `API_VERSION` (use `generaltranslation/api`), `derive`, `declareVar`, `decodeVars` (use `generaltranslation`), and `isErrorResult`.
- `generaltranslation/types` drops `CheckFileTranslationsOptions`, `DownloadFileOptions`, `DownloadFileBatchOptions`, `ProcessMovesOptions`, `PublishFilesResult` (use `PublishFilesResponse` from `generaltranslation/api`), `TranslationResultReference`, and `CreateBranchQuery` (use `CreateBranchData['body']`).
