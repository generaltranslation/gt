---
'generaltranslation': minor
'gt': minor
---

Add Lottie file support and project font syncing.

- Support `.lottie` files as a new `LOTTIE` file format. Lottie bundles are binary (zip), so their content is carried base64-encoded end-to-end — including existing translated `.lottie` targets on `gt upload` — and skips the UTF-8 encode/decode and text merge paths (new `isBinaryFileFormat` / `BINARY_FILE_FORMATS` exports). Lottie translations are processed asynchronously and require the `gt stage` + `gt download` flow, so `gt translate` now exits with an error pointing users there when a project has Lottie files and staging isn't enabled. (As before, enabling staging makes `gt translate` download staged results rather than translating inline.)
- Reject `.lottie` files that use After Effects expressions (executable code): the upload fails and names every offending file, since expression-driven text can't be translated safely.
- Add `GT.uploadFonts` and a `fonts` config option (include/exclude globs) so project fonts are synced to the API before translating formats that need them (including during `gt stage`, so async Lottie jobs get the real fonts). Globs resolve from the project root. Font sync is idempotent and non-fatal on failure.
- Keep staged lock entries staged until every configured locale has downloaded, and only require `_versionId` for `gt download` when an inline GTJSON template is part of the download and config IDs aren't omitted (staged downloads resolve versions from `gt-lock.json`, file-only projects never have a `_versionId`, and `omitConfigIds` projects use the GTJSON's own content-derived version).
