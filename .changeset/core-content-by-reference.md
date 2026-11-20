---
'generaltranslation': major
---

`overwriteTranslations()` takes `TranslationOverwrite` entries: `{ localContent, diff }` → `{ content }`, the translation's full text. `upsertAssets()` takes `AssetUpload` entries. Both send content too large for one 4MB request by reference, through `createFileUploads` and `createAssetUploads`, and overwrites are split so no request names more than 150MB of uploads. A call's `timeout` also bounds each upload the call makes, for these and for `uploadSourceFiles()` and `uploadTranslations()`.
