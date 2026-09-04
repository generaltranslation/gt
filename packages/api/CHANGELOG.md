# @generaltranslation/api

## 0.1.0

### Minor Changes

- [#2179](https://github.com/generaltranslation/gt/pull/2179) [`33ea383`](https://github.com/generaltranslation/gt/commit/33ea383b5d1593793b0a704b35b8a750ea8c3274) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Add `gt project create` and `gt project status` commands, and migrate CLI API requests to the generated SDK through `generaltranslation/api`.

### Patch Changes

- [#2180](https://github.com/generaltranslation/gt/pull/2180) [`3c33a75`](https://github.com/generaltranslation/gt/commit/3c33a75c738c2f433cfdf4e19d75b189c0100f38) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Route runtime and Sanity API requests through the generated General Translation API SDK while preserving the existing public interfaces and caller-configured runtime timeouts.

- [#2202](https://github.com/generaltranslation/gt/pull/2202) [`6ac4ba3`](https://github.com/generaltranslation/gt/commit/6ac4ba33a0230fb8aecae7c7677cfd38c361bd9c) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Expose `spec/openapi.json` through the API and core package exports.

## 0.0.6

### Patch Changes

- [#2228](https://github.com/generaltranslation/gt/pull/2228) [`de66e5f`](https://github.com/generaltranslation/gt/commit/de66e5f41e05f22d51661faacae78b4fb3d86035) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add Android `strings.xml` support to the CLI. Configure an `androidStrings` entry under `files` in `gt.config.json` to upload Android string resources and download the translated per-locale files.

  Translations are written to the resource directory the platform expects, so `fr-CA` becomes `values-fr-rCA` and `zh-Hans` becomes `values-b+zh+Hans`. Android reads the locale out of the directory name and fails the build on one it cannot parse.

## 0.0.5

### Patch Changes

- [#2226](https://github.com/generaltranslation/gt/pull/2226) [`44aabc7`](https://github.com/generaltranslation/gt/commit/44aabc734d99fab4fcab7faedc84d20b5772bde3) Thanks [@eoinest](https://github.com/eoinest)! - Rename the `.strings` and `.stringsdict` file formats. The API format names become `DOT_STRINGS` and `DOT_STRINGSDICT`, and the `gt.config.json` keys under `files` become `dotStrings` and `dotStringsdict`.

  **This is a breaking configuration change.** A `gt.config.json` that still uses `files.strings` or `files.stringsdict` will silently stop matching those files, because the old keys are no longer recognised file types. Rename them to `files.dotStrings` and `files.dotStringsdict`. The file extensions on disk are unchanged, and translated output is still written as `.strings` and `.stringsdict`.

  The old names identified a vendor rather than a file. Apple ships four string formats — `.strings`, `.stringsdict`, `.xcstrings` and `.plist` — so `APPLE_STRINGS` never said which one it meant. The new names identify the extension itself, the way developers say it out loud.

## 0.0.4

### Patch Changes

- [#2222](https://github.com/generaltranslation/gt/pull/2222) [`091c964`](https://github.com/generaltranslation/gt/commit/091c964b45eba191d6e35bc1cdb93cc3683a3f71) Thanks [@eoinest](https://github.com/eoinest)! - Add Apple `.strings` support to the CLI. Configure a `strings` entry under `files` in `gt.config.json` to upload `.strings` sources and download the translated per-locale files. `.strings` files written as UTF-16 by older versions of Xcode upload correctly: their bytes are sent unmodified so the API can read the byte order mark.

  Fix `save-local` for formats whose content travels base64. It compared the local file against the still-encoded server copy, so a Lottie translation reported an edit on every run. Unchanged files are now recognised, and an edited file whose bytes are not valid UTF-8 is reported by name rather than submitted as unreadable text.

- [#2222](https://github.com/generaltranslation/gt/pull/2222) [`b8a9679`](https://github.com/generaltranslation/gt/commit/b8a96797860f2bb7b12f3c307d47c9b1fead2096) Thanks [@eoinest](https://github.com/eoinest)! - Add Apple `.stringsdict` support to the CLI. Configure a `stringsdict` entry under `files` in `gt.config.json` to upload `.stringsdict` plural rule sources and download the translated per-locale files.

## 0.0.3

### Patch Changes

- [#2208](https://github.com/generaltranslation/gt/pull/2208) [`0ce6acc`](https://github.com/generaltranslation/gt/commit/0ce6acc7ab27fb392c48b1dbd7cc24bd4c4b7755) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.0.2

### Patch Changes

- [#2195](https://github.com/generaltranslation/gt/pull/2195) [`ca08766`](https://github.com/generaltranslation/gt/commit/ca0876633182eb01d969d56dea21dd1e88612339) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.0.1

### Patch Changes

- [#2178](https://github.com/generaltranslation/gt/pull/2178) [`34845f9`](https://github.com/generaltranslation/gt/commit/34845f92d64fd9c94a712e4710e8958022066b7b) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Add the generated TypeScript SDK for the General Translation API, derive the core `FileFormat` type from its OpenAPI-generated contract, and retry requests according to method safety and the configured backoff policy.
