# @generaltranslation/api

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
