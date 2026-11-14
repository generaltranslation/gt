# @generaltranslation/api

## 0.7.0-samsara.2

### Minor Changes

- ac29d18: Move to `2026-10-08.v1` and replace legacy generated operations with canonical ones. `createApiClient` no longer accepts `projectId` or sends `gt-project-id`; project-scoped operations use `path.projectId`. It takes no `apiVersion`: the client always sends `API_VERSION` by default, and per-call headers override it.

  `awaitJobs(client, projectId, jobIds, options)` polls `queryJobs` in batches of 100 with the pinned `API_VERSION`. Results use `{ id, status, subject?, error? }`; `not_found` is terminal and `unknown` means no status was received before the deadline. `queryJobsInBatches` is also available for batched status reads.

  Wait for translation jobs before reading files: unstored translations return `not_found` (404 for single reads); stored but incomplete translations return `pending` and should be read again later.

  `pollJobs` and `GetJobStatuses` are removed; use `awaitJobs`.

- ac29d18: `ApiError` carries the API's error code. `status` is the HTTP status (previously `code`), and `code` is the API's machine-readable cause, such as `permission_missing`, or `undefined` when the response has none (for example a gateway error page). The constructor is `new ApiError(message, status, code?)`, replacing `new ApiError(error, code, message)`. Match on `code`, never on `message`, and fall back to `status` for codes you do not recognize; `ErrorCode` lists the known codes.

  `isTransientApiError(error)` reports whether a failure may clear on a later read. It goes by the HTTP status the API chose (423, 425, 429 and 5xx, plus a gateway's 408 or 504), not by a list of error codes. It does not make a write safe to repeat.

  `awaitJobs` keeps polling through transient failures until its deadline; their jobs stay pending and the next polls back off. A rate limit the transport could not wait out within one poll waits its `Retry-After` before the next poll. Permanent failures still throw, unless they arrive after the deadline. A 429 `ApiError` carries `retryAfterMs`, the wait the API asked for. Retry waits end as soon as the request's signal aborts, and the transport then returns the last 429 or 5xx response instead of the abort reason. The transport retries `queryFiles` and `queryFilesContent`, POST operations that only read, like idempotent requests: after a network error, a 429 or a 5xx, within the same retry budget.

  The bundled spec now includes error codes: `ErrorResponse` is `{ error, code }`, each operation's `<Operation>Error` narrows `code` to the codes it declares, failed batch results and `translateContent` entries carry `code`, and the workspace plugin's translate result lists `failures`. `FileFormat` adds `PNG`, `JPEG` and `MP4`; `ModelProvider` no longer includes `HYPERCLOVA`.

- ac29d18: Source and translation uploads type a file's `dataFormat` as `FileDataFormat`, which is `DataFormat` without `MESSAGE_TREE`: a message tree's format is set per key, in a GTJSON file's `formatMetadata`. Context Management operations document the `project:context:read` and `project:context:write` scopes, which work on a project the group is assigned to.
- ac29d18: Sync the `2026-10-08.v1` contract's file changes. `createFileUploads` returns presigned URLs to PUT files to; an upload then sends `upload: { sha256 }` in place of `content`, which is required for files over 4MB. Source uploads accept `metadata.previewUrl`, the page that shows that version of the file. Translation uploads no longer take `transformFormat`: a translation's `fileFormat` is the format it is saved in, the source's format or a supported conversion (POT to PO). File content reads return `downloadUrl` when `data` is `null` because the file is too large to return inline, and for media files. `createOrgApiKey` creates organization API keys.
- ac29d18: Sync the 2026-10-08.v1 contract: a source upload's `formatMetadata` is `{ content }` with the metadata, or `{ upload: { sha256 } }` for metadata PUT through `createFileUploads`; translation uploads no longer take the source's `formatMetadata`. Adds `updateFiles` for updating source files and translations, and raises the uploaded non-media file limit to 150MB.
- 8ba23e5: `createApiClient` gzips request bodies of 32 KiB or more and sends `Content-Encoding: gzip`, so the server must accept gzip-encoded bodies. If the server rejects the encoding (415, or 400 `invalid_content_encoding`), the client resends the request uncompressed once. Set `compression: false` when a custom `fetch` or proxy must read plain request bodies. `putFileUpload` and `fetchFileDownload` are never compressed.
- ba09ee2: `putFileUpload(upload, bytes, options?)` PUTs a file's bytes to a presigned URL from `createFileUploads`, with no API credentials. It takes the client's `fetch` and `retryPolicy`, and the whole PUT, retries included, times out when the URL expires.
- ac29d18: Sync the 2026-10-08.v1 contract: writes return data instead of acknowledgement flags.
  - `listProjectApiKeys`, `getProjectApiKey` and `deleteProjectApiKey` are new. A `ProjectApiKey` is `{ id, name, permissions, createdAt, lastUsedAt }`.
  - `createProject`, `createBranch`, `createProjectApiKey`, `createOrgApiKey` and `setTag` return the resource itself: `response.project.id` → `response.id`, and likewise for `branch`, `apiKey` and `tag`. A new key is the `ProjectApiKey` fields plus `key`, without `projectId`, `type` or `orgId`.
  - `setTag`, `assignContextGroup` and `setContextGlossaryTranslation` no longer return `created` or `outcome`. The status code says it: `201` when the request created the resource, `200` otherwise.
  - `translateContent` takes `requests` as an array and returns `{ summary, results }`, with one result per request in request order. A result has `status: 'succeeded'` or `status: 'failed'`, replacing `success`. `generated` is removed with no replacement. `RuntimeTranslationRequest` and `RuntimeTranslationResponse` are now `TranslateContentRequest` and `TranslateContentResponse`.
  - Context Management writes no longer return `committed`. Creates and updates return the resource (`createContextGroup().groupId` → `.id`), deletes and unassign return `{ deleted: true }`, and the Glossary and Custom Prompt upserts return `counts` with `items` (`id` and `outcome` per item).

- a191c9a: `gt download` saves translated media over 20MB, which the API returns as `data: null` and a signed `downloadUrl`, instead of reporting it as failed. It streams the file to disk through a temporary `.part` file, so a download that is cut off leaves the previous file in place, and requests the file again if the download broke off mid-stream; a download request the API client already retried fails the file. It asks for each file's URL when that file's turn comes, so a long queue of downloads does not outlive the 15-minute URLs: a file the API reports `pending` again is requested again, and any other status fails the file and is reported.

  `project.fetchFileDownload(downloadUrl)` in `generaltranslation` opens such a URL and returns the file as a stream, so it can be saved without holding it in memory. `getFileContent()` and `queryFilesContent()` return these results as the API sends them. `fetchFileDownload(downloadUrl)` in `@generaltranslation/api` is the underlying request, sent without API credentials. Reading the stream fails when the download sends nothing for the request timeout (60 seconds), so a stalled download does not hang.

### Patch Changes

- 82999f0: Import `ApiVersion` from its generated definition instead of through the client wrapper module. `ApiVersion` stays a type-only export; no public API change.
- 96f428a: - `generaltranslation` no longer exports the `JsonPrimitive` type; use `string | number | boolean | null`.
  - `@generaltranslation/api`: `ApiClientConfig.timeoutMs` takes only a number; `timeoutMs: false` is removed. To let a custom `fetch` own timeouts, pass a `timeoutMs` longer than its own; any larger value works, `Infinity` included.
  - `@generaltranslation/api` no longer exports the `PresignedFileUpload` type; use `Parameters<typeof putFileUpload>[0]`.
- e29f6f9: Resolve option defaults once, where the options are accepted, and pass required values to the code below. No behaviour change for apps.
  - `@generaltranslation/api` exports `DEFAULT_TIMEOUT_MS`, the default request timeout.
  - `gt-i18n/internal`: `I18nConfig`'s `resolveSupportedLocale(candidates)` no longer takes a config override and uses the configuration GT was initialized with. `determineSupportedLocale(candidates)` is removed; use `determineLocale(candidates)`, which matches the same way. `LocaleResolverConfig` is no longer exported.
  - `gt-i18n/internal/compat`: `new DictionaryManager()` takes a config with `dictionary`, `loadDictionary` and `cacheExpiryTime` all set. `initializeDictionaryManager()` still accepts the optional params and fills in the defaults.

## 0.7.0-samsara.1

### Minor Changes

- 886232a: The data format of a message tree is named `MESSAGE_TREE`. It was `ICU_TREE`, which reads as the ICU parser's syntax tree, the one tree it is not; everything else already calls it a message tree (`MessageTree`, `formatMessageTree`, `messageTreeToIcu`).

  The name is part of what `hashSource` hashes, so every tagged-template message gets a new hash: regenerate the translations of `/unstable` messages. A server that still expects `ICU_TREE` rejects the new name, and the other way round.

## 0.7.0-samsara.0

### Minor Changes

- cf23e00: From `main` (generaltranslation 9.5.10, `@generaltranslation/api` 0.5.7): the API client and adapter add `updateFiles` for updating source files and translations (#2653). `main`'s large-upload helpers (`createFileUploads`, `putFileUpload`, `uploadSourceFileReferences`, from #2661 in `@generaltranslation/api` 0.6.0) are not included.

## 0.6.0

### Minor Changes

- [#2661](https://github.com/generaltranslation/gt/pull/2661) [`b3c3647`](https://github.com/generaltranslation/gt/commit/b3c3647239a6c44c3549e722b7001b83624865f8) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Source files over the upload route's inline limit (20MB, or more than a request can carry with their `formatMetadata`) are uploaded straight to storage, content and `formatMetadata` both, and sent by reference, so `gt stage` and `gt translate` no longer fail with 413 on large files or large source-code context. `@generaltranslation/api` adds `createFileUploads`, `putFileUpload`, and `uploadSourceFileReferences`.

## 0.6.0-samsara.0

### Minor Changes

- 4b6ea22: Message trees are a data format: `DataFormat` adds `'ICU_TREE'`, and `ContentByFormat` and `ContentFor` in `@generaltranslation/format/types` map each data format to its content, and `Content` covers every data format, message trees included. `hashSource` in `generaltranslation/id` hashes a message tree passed with `dataFormat: 'ICU_TREE'` like any other source, with its `context`, `maxChars` and `requiresReview`; object key order is ignored, and the format in the hashed data keeps tree keys apart from string and JSX keys. The API contract and runtime translation accept `ICU_TREE`.

## 0.5.7

### Patch Changes

- [#2653](https://github.com/generaltranslation/gt/pull/2653) [`e1c64a3`](https://github.com/generaltranslation/gt/commit/e1c64a3c27c7a05ffeb81eb2d04ace795d0c3ab5) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - `previewUrl` resolvers now get the Sanity language id of the page as a second argument, `resolve(doc, { language })`, so each locale links to its own page. Imported translations send their page as their preview URL, resolved from the document they were written to. Adds `updateFiles` to the API client and adapter for updating source files and translations.

## 0.5.6

### Patch Changes

- [#2604](https://github.com/generaltranslation/gt/pull/2604) [`c460193`](https://github.com/generaltranslation/gt/commit/c46019337dda8440a7174d783ad94a0f9b15f79a) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Add `--org-id <orgId>` to `gt api-key create` to create an organization API key instead of a project key. It always uses your `gt login` session, even when an API key is configured, because API keys cannot create organization keys. `--permission` now also accepts organization permissions such as `org:context:read`, `org:projects:create`, and `project:api_keys:write`; passing one without `--org-id` fails before any request. Project keys are unchanged.

  The SDK adds `createOrgApiKey` and the `OrgApiKeyPermission` enum, and the shared API adapter adds `createOrgApiKey`.

## 0.5.5

### Patch Changes

- [#2520](https://github.com/generaltranslation/gt/pull/2520) [`4f31fef`](https://github.com/generaltranslation/gt/commit/4f31fef6e125a84243980ed2ea9d48bd3561c77d) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Abort timed-out requests reliably. `createTimeoutFetch` now passes its abort signal to `fetch` in the request init as well as on the copied `Request`, so the `timeoutMs` timeout fires in Node even if garbage collection runs while the request is pending, and custom `fetch` implementations that read only `request.signal` still see it. The timeout aborts with its own `Request timed out after <ms>ms` error, so a custom `fetch` that rejects with its own error after the timeout keeps that error.

## 0.5.5-samsara.0

### Patch Changes

- 0604209: Seed the Samsara prerelease channel.

## 0.5.4

### Patch Changes

- [#2402](https://github.com/generaltranslation/gt/pull/2402) [`9764db8`](https://github.com/generaltranslation/gt/commit/9764db8ddb466d243bbb44c7c9fb031053d683fa) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - `ApiError` no longer uses an HTML error page as its message; it falls back to the response status text, or to the HTTP status code when there is none.

- [#2417](https://github.com/generaltranslation/gt/pull/2417) [`bd632a8`](https://github.com/generaltranslation/gt/commit/bd632a888ce27257efeed8512eb6261a16987bb2) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Derive `API_VERSION` and the `ApiVersion` type from the spec's `ApiVersion` schema instead of a single endpoint's header type. The default version stays `2026-03-06.v1`.

## 0.5.3

### Patch Changes

- [#2386](https://github.com/generaltranslation/gt/pull/2386) [`1425b43`](https://github.com/generaltranslation/gt/commit/1425b43f885c73bfa2e5377061fbacc9dfe9e460) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.5.2

### Patch Changes

- [#2359](https://github.com/generaltranslation/gt/pull/2359) [`7fa27b2`](https://github.com/generaltranslation/gt/commit/7fa27b2f2e8d33d244b30622b25dcd5d3e5d1cfa) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.5.1

### Patch Changes

- [#2349](https://github.com/generaltranslation/gt/pull/2349) [`24db902`](https://github.com/generaltranslation/gt/commit/24db9022171bb47160545d94691ba528d93a08f3) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add .NET resource files (`.resx`, and `.resw` with the same schema) as a supported file type, uploaded verbatim under the `RESX` format

## 0.5.0

### Minor Changes

- [#2356](https://github.com/generaltranslation/gt/pull/2356) [`ddb3e6d`](https://github.com/generaltranslation/gt/commit/ddb3e6dcef680f310ec7996d174c042dcd482706) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Clients from `createApiClient` now throw an `ApiError` carrying the HTTP status in `code` for failed `throwOnError` calls, including those made by `awaitJobs`, instead of the decoded response body. Non-throwing calls still return the decoded body in `error`. `ApiError` moves to this package; `generaltranslation/errors` re-exports it.

- [#2357](https://github.com/generaltranslation/gt/pull/2357) [`3013bc2`](https://github.com/generaltranslation/gt/commit/3013bc22fef5b1297ed56395b80195c9198509fe) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Add `paginate` to iterate every item of a list operation without handling cursors: `for await (const project of paginate(listProjects, { client })) {}`. The item type is inferred from the operation, `query.cursor` resumes from a saved position, the next page is requested only when iteration reaches it, and a failed page throws an `ApiError`.

### Patch Changes

- [#2328](https://github.com/generaltranslation/gt/pull/2328) [`ab78709`](https://github.com/generaltranslation/gt/commit/ab78709c5b2f0334379588005ba792bbb95986ba) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.4.1

### Patch Changes

- [#2340](https://github.com/generaltranslation/gt/pull/2340) [`5d75eb4`](https://github.com/generaltranslation/gt/commit/5d75eb475a9e36a61845f0368566a9d40466251c) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add SubRip (`.srt`) subtitle files as a supported file type, uploaded verbatim under the `SRT` format

## 0.4.0

### Minor Changes

- [#2205](https://github.com/generaltranslation/gt/pull/2205) [`c734b08`](https://github.com/generaltranslation/gt/commit/c734b084f0a50d1b2787c86ec790403f88803650) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Add `gt login`, `gt logout`, and `gt whoami`. Login uses openid-client with the seeded public `gt-cli` client, S256 PKCE and a loopback callback against the General Translation dashboard. When `--no-browser` is set or the loopback listener cannot bind, login uses device authorization with a displayed verification code. Device polling and retries follow openid-client policy (not blanket network/all-5xx retries). Signed identity tokens are validated before saving per-server credentials in `$XDG_STATE_HOME/gt/credentials.json` (default `~/.local/state/gt/credentials.json`, 0600); refresh preserves the validated account identity. Obsolete pre-release logins require `gt login` again without resetting other servers' entries. Login requests a token for the project's configured `baseUrl` (`GT_API_URL` overrides), records that resource with the credentials, and the CLI refuses to send a login issued for a different API instead of letting the server reject it. The API client and core request path accept a refreshable user-token provider, used only when no API key is configured — an explicit API key always wins. The former development-key rejection is gone; every `gtx-` key is just a key with its own permissions.

- [#2205](https://github.com/generaltranslation/gt/pull/2205) [`08e6d82`](https://github.com/generaltranslation/gt/commit/08e6d82df8f02045f43bfcc87b35e9a4ae4a9f69) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Expose successful job-poll responses through an `onPoll` hook. Route CLI font and wizard requests through the generated SDK, use the shared sequential job poller, and remove the retired hand-written HTTP client implementations.

## 0.3.2

### Patch Changes

- [#2317](https://github.com/generaltranslation/gt/pull/2317) [`fde2f0e`](https://github.com/generaltranslation/gt/commit/fde2f0efd4d875b502b1d0bbe5d672abc4babc69) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.3.1

### Patch Changes

- [#2293](https://github.com/generaltranslation/gt/pull/2293) [`a569f0d`](https://github.com/generaltranslation/gt/commit/a569f0d661ba6b28dc55375b56113a68403e2e8d) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.3.0

### Minor Changes

- [#2215](https://github.com/generaltranslation/gt/pull/2215) [`5f5843b`](https://github.com/generaltranslation/gt/commit/5f5843b94066d9ee9c0703722105a189d2a4e3d5) Thanks [@chenxin-yan](https://github.com/chenxin-yan)! - Consolidate base64, file-content, locale-mapping, and job-polling seams in `generaltranslation/internal`, remove the generated API package's workspace dependency surface, and reuse the core helpers in the CLI and Sanity integration. `encodeBase64`, `decodeBase64`, `encodeFileContent`, and `decodeFileContent` are removed from `@generaltranslation/api` (and therefore `generaltranslation/api`); import the `generaltranslation/internal` equivalents instead.

### Patch Changes

- [#2299](https://github.com/generaltranslation/gt/pull/2299) [`50098c6`](https://github.com/generaltranslation/gt/commit/50098c68e33b13585dde418e227cfca1cef3bf7e) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Accept whole markdown and MDX documents on the runtime translate endpoint via the new `fileFormat` entry metadata (`MD` or `MDX`).

- [#2287](https://github.com/generaltranslation/gt/pull/2287) [`01658bd`](https://github.com/generaltranslation/gt/commit/01658bd018a337a9f2fb8f058195c7ea3d6f534e) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.2.1

### Patch Changes

- [#2217](https://github.com/generaltranslation/gt/pull/2217) [`bf3ce1e`](https://github.com/generaltranslation/gt/commit/bf3ce1eb967e1798c95b78c04313de2c8362932c) Thanks [@internal-gt-public-api-sync](https://github.com/apps/internal-gt-public-api-sync)! - Sync the GT API OpenAPI contract and regenerate the SDK.

## 0.2.0

### Minor Changes

- [#2254](https://github.com/generaltranslation/gt/pull/2254) [`8e59be2`](https://github.com/generaltranslation/gt/commit/8e59be28c129b4b9509ce8897156de3282b2a295) Thanks [@eoinest](https://github.com/eoinest)! - Add Apple `.xcstrings` catalog upload support to the CLI. An `.xcstrings` catalog holds every locale in one file; on upload the CLI extracts a source-only slice (only the catalog's `sourceLanguage` localization per entry) and uploads that as the source document. The slice is serialized with a pinned byte layout and hashed into its `versionId`, so an unchanged catalog re-slices byte-identically and does not re-upload. Configure it under `files.xcstrings` in `gt.config.json`; patterns without `[locale]` are expected because the catalog is shared across locales.

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
