# gt-payload

## 1.0.0-samsara.10

### Major Changes

- 1a5e9ae: `GT_PROJECT_ID` and `GT_API_KEY` are read once, when GT is initialized, and never after. Each option wins over its variable, and an empty string counts as unset.
  - gt-i18n no longer reads `GT_API_KEY` when a runtime translation is requested. A variable set after initialization is not picked up: load your `.env` file before you call `initializeGT()`, or pass `apiKey`.
  - gt-node: `initializeGT()` reads both variables when it is called.
  - gt-payload: `gtPlugin()` reads both variables when it is called, not when the first translation runs. An empty-string `apiKey` or `projectId` option now falls back to the variable. A missing key still fails the run that needs it, not the Payload config.
  - gt-react: `initializeGT()` from the `react-server` entry reads both variables, like the server and client entries. Before, it read neither.
  - gt-next: a `projectId` in `gt.config.json` or `withGTConfig()` props now reaches the runtime, where it is used before `GT_PROJECT_ID`, as in every other package. Before, production read only `GT_PROJECT_ID`, so a project ID set only in `gt.config.json` loaded no translations. `withGTConfig()` accepts `projectId` again, and throws when the configured project ID and `GT_PROJECT_ID` differ. A project ID set only through `GT_PROJECT_ID` is not built into the app, so each deployment still reads its own. The API key is still read only from `GT_API_KEY`.
  - The CLI behaves as before.

### Minor Changes

- 831d39f: Use canonical GT methods. Report per-document source-upload failures and per-translation upload failures while continuing with saved documents.

  When billing stops a translation (HTTP 402), the admin panel shows the API's message with a hint for where to fix it in the dashboard. `TranslateResult.usageLimitReached` is replaced by `billingError` (`{ message, code? }`, the API's 402 message and error code as sent), and the runs collection's `usageLimitReached` field by the text fields `billingMessage` and `billingCode`; on Postgres or SQLite run `payload migrate:create` to replace the column. Failed plugin requests return the API error `code` with `error`, and the admin panel advises trying again only for failures that may clear.

  Custom `GtClient` implementations must replace `enqueueFiles`, `downloadFileBatch`, and `checkJobStatus` with `translateFiles`, `queryFilesContent`, and `queryJobs`. `awaitJobs`, `uploadSourceFiles`, and `uploadTranslations` follow `generaltranslation` 10: `awaitJobs` takes job IDs and returns `{ id, status, error? }` jobs, and uploads return `{ summary, results }`. `GtClient` is the subset of `ProjectHandle` the plugin uses, without `customMapping`: pass `client: new GeneralTranslation({ apiKey, projectId, localeConfig: { customMapping } })` instead of `client: new GT({ apiKey, projectId, customMapping })`. Without an `apiKey` option or `GT_API_KEY`, the run fails with a gt-payload error. The plugin no longer maps job locales back through `customMapping`; a project handle already reports them under the configured codes.

### Patch Changes

- ea429a2: Locale options now take their types from `GTConfig` or `LocaleConfig` instead of repeating them: `VueCompilerOptions`, gt-vue's `CreateGTOptions` and `InitializeGTSPAOptions`, gt-sanity's `GTPluginConfig`, gt-payload's `GtPluginOptions` and the gt-react-native plugin's `config` option. The accepted values are unchanged. gt-sanity links to the dashboard URL from `generaltranslation`.
- 82999f0: Import format types and `ApiError` from `@generaltranslation/format` and `@generaltranslation/api` instead of through `generaltranslation`. `GTIntl` still comes from `generaltranslation`, which fills in its defaults. gt-payload now depends directly on `@generaltranslation/format` and `@generaltranslation/api`. No public API change.
- 943c094: Import types and helpers from their single owning entry now that the types-only subpaths are removed. No public API change.
- Updated dependencies [ac29d18]
- Updated dependencies [ac29d18]
- Updated dependencies [ac29d18]
- Updated dependencies [ac29d18]
- Updated dependencies [ac29d18]
- Updated dependencies [8ba23e5]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ac29d18]
- Updated dependencies [96f428a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [63b6748]
- Updated dependencies [ea429a2]
- Updated dependencies [82999f0]
- Updated dependencies [ba09ee2]
- Updated dependencies [ba09ee2]
- Updated dependencies [943c094]
- Updated dependencies [ba09ee2]
- Updated dependencies [82999f0]
- Updated dependencies [96f428a]
- Updated dependencies [3832c15]
- Updated dependencies [943c094]
- Updated dependencies [a191c9a]
- Updated dependencies [2d7f9bd]
- Updated dependencies [1a5e9ae]
- Updated dependencies [e29f6f9]
  - @generaltranslation/api@0.7.0-samsara.2
  - generaltranslation@10.0.0-samsara.9
  - @generaltranslation/format@1.0.0-samsara.9

## 0.2.0-samsara.9

### Patch Changes

- generaltranslation@10.0.0-samsara.8

## 0.2.0-samsara.8

### Patch Changes

- generaltranslation@10.0.0-samsara.7

## 0.2.0-samsara.7

### Patch Changes

- Updated dependencies [6440bd1]
- Updated dependencies [ada6894]
  - generaltranslation@10.0.0-samsara.6

## 0.2.0-samsara.6

### Patch Changes

- Updated dependencies [886232a]
  - generaltranslation@10.0.0-samsara.5

## 0.2.0-samsara.5

### Patch Changes

- Updated dependencies [7ef8d91]
- Updated dependencies [7ef8d91]
- Updated dependencies [3c013b5]
  - generaltranslation@10.0.0-samsara.4

## 0.2.0-samsara.4

### Patch Changes

- Updated dependencies [cf23e00]
  - generaltranslation@10.0.0-samsara.3

## 0.2.0-samsara.3

### Patch Changes

- generaltranslation@10.0.0-samsara.2

## 0.2.0-samsara.2

### Patch Changes

- Updated dependencies [22b6915]
- Updated dependencies [f3ed76d]
- Updated dependencies [4b6ea22]
- Updated dependencies [cc73381]
- Updated dependencies [726168a]
- Updated dependencies [040ea63]
  - generaltranslation@10.0.0-samsara.1

## 0.2.0-samsara.1

### Minor Changes

- dc7e89b: Support Payload 4 and drop Payload 3. On Payload 3, stay on `gt-payload@^0.1`.
  - Requires `payload`, `@payloadcms/next` and `@payloadcms/ui` 4, and Next.js 16.4 or later.
  - Translating without a signed-in user, as from server code or Payload's job queue, still skips access rules now that Payload's Local API applies them by default.
  - The Translate button on globals moves to `admin.components.edit.beforeDocumentControls`, where Payload 4 renders it.
  - Blocks referenced by slug, in blocks fields and in Lexical rich text, are translated.
  - Payload's `slug` field type is left to Payload and the editor, as the slug field was before.
  - The admin panel uses Payload 4's design tokens, and the Translations page has its own title and breadcrumb.
  - The Translate button appears only on documents with text to translate and only for users who may save them. A refused request says the user lacks permission instead of asking them to try again.
  - A site-wide run by a signed-in user covers only the documents they may edit, instead of reporting the rest as failed. This also applies to `translateSite` and `saveSiteTranslations` with a `user`.
  - A run that asks for a locale General Translation cannot translate into, or one outside the Payload config, is refused with a 400 naming it, instead of quietly translating less than asked.

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.12

## 0.1.5

### Patch Changes

- Updated dependencies [[`b3c3647`](https://github.com/generaltranslation/gt/commit/b3c3647239a6c44c3549e722b7001b83624865f8)]:
  - generaltranslation@9.5.11

## 0.1.4

### Patch Changes

- Updated dependencies [[`e1c64a3`](https://github.com/generaltranslation/gt/commit/e1c64a3c27c7a05ffeb81eb2d04ace795d0c3ab5)]:
  - generaltranslation@9.5.10

## 0.1.3-samsara.0

### Patch Changes

- bb107a8: Fix published type declarations that failed to resolve, or resolved to CommonJS types, under `moduleResolution` `node16` or `nodenext`.
- Updated dependencies [da7af80]
- Updated dependencies [bb107a8]
- Updated dependencies [002f579]
  - generaltranslation@10.0.0-samsara.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`c460193`](https://github.com/generaltranslation/gt/commit/c46019337dda8440a7174d783ad94a0f9b15f79a)]:
  - generaltranslation@9.5.9

## 0.1.2

### Patch Changes

- Updated dependencies []:
  - generaltranslation@9.5.8

## 0.1.2-samsara.0

### Patch Changes

- generaltranslation@9.5.8-samsara.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`c220f39`](https://github.com/generaltranslation/gt/commit/c220f39182a61be3d8139bfe18c5bced0f2956dc)]:
  - generaltranslation@9.5.7

## 0.1.0

### Minor Changes

- [#2429](https://github.com/generaltranslation/gt/pull/2429) [`2b4862d`](https://github.com/generaltranslation/gt/commit/2b4862d30c0a7ddcade5fd7b457f732e73b8c590) Thanks [@fernando-aviles](https://github.com/fernando-aviles)! - Add `gt-payload`, a plugin that translates a Payload CMS site's localized fields from a button on each document or for the whole site, and saves edits made in Payload back to General Translation.
