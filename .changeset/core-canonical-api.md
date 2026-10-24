---
'generaltranslation': major
---

`GT` calls only the canonical `2026-10-08.v1` API, with project IDs in paths rather than `gt-project-id`. Runtime translation uses `POST /v2/projects/{projectId}/translate`. Batched methods split requests at the server caps: 25 moves, 10 fonts, and 100 for the rest; move lists require disjoint file IDs, and publish lists may name each file version once. Batched writes return `summary` and per-item `results`; a failed item is reported there instead of thrown.

Removed `GT` methods and their replacements on the project-scoped `GT` (below):

- `getProjectInfo()`, `getProjectData()` → `get()`
- `queryBranchData()` → `listBranches()`
- `getOrphanedFiles()` → `listBranchFiles()`
- `processFileMoves()` → `moveFiles()`
- `setupProject()` → `generateProjectContext()`
- `checkJobStatus()` → `queryJobs()` or `getJob()`
- `enqueueFiles()` → `translateFiles()`
- `createTag()` → `setTag()`
- `submitUserEditDiffs()` → `overwriteTranslations()`
- `queryFileData()` → `queryFiles()`
- `querySourceFile()` → `getFileStatus()`
- `downloadFile()` → `getFileContent()`
- `downloadFileBatch()` → `queryFilesContent()`
- `uploadFonts()` → `account.org(orgId).upsertAssets()` on an account-scoped `GT`

`update()`, `updateBranch()`, and `createApiKey(body)` (creates a project API key with exactly the requested permissions) are new.

Changed methods:

- `createBranch()` takes `{ name, isDefault }` only and sends only the create request: a name the project already has throws an `ApiError` with code `already_exists`. To reuse an existing branch, call `listBranches({ name: [name] })` first and create only when it returns none.
- `awaitJobs(jobIds, options)` takes job IDs only and returns jobs as `{ id, status, subject?, error? }`, with `error` a string. A job the project does not have is `not_found`; `unknown` means the job was not polled before the timeout. `options.onPoll` receives each poll's statuses.
- `queryJobs(jobIds, { signal, timeout })` takes an optional `signal` that aborts in-flight requests.
- `translate()` and `translateMany()` failures (`TranslationError`) carry the API's string error `code` (for example `plan_feature_unavailable`) instead of a number; a missing or invalid translation reads `internal_error`.
- `uploadSourceFiles()` and `uploadTranslations()` return `{ summary, results }`, without `uploadedFiles`, `count`, or `message`.
- `uploadSourceFiles(files, options?)` sends `options.sourceLocale`, else `localeConfig.defaultLocale`; with neither, the request has no `sourceLocale` and the project's default locale applies.
- `generaltranslation/internal` exports `credentialScope(credentials)`: `'project'` for a project API key, otherwise `'account'`.
- `publishFiles()` returns one result per file version, with each translation's `locale` and `status` under `translations`, and no `success`. `PublishFileEntry` has no `fileName`.
- Job results from `translateFiles()`, `queryJobs()`, `getJob()`, and `awaitJobs()` report `subject.locale` under its `customMapping` alias, like other results.
- `queryFiles()` and `queryFilesContent()` send selectors that resolve to the same file, branch, version, and locale once, and return a result for every selector in order with its requested locale.

`generaltranslation/types` removes `AwaitJobsOptions`, `AwaitJobsResult`, `BranchDataResult`, `BranchQuery`, `CheckJobStatusResult`, `CreateTagOptions`, `CreateTagResult`, `DownloadedFile`, `DownloadFileBatchResult`, `EnqueueFilesOptions`, `EnqueueFilesResult`, `FileDataQuery`, `FileDataResult`, `GetOrphanedFilesResult`, `JobResult`, `JobStatus`, `MoveResult`, `OrphanedFile`, `ProcessMovesResponse`, `SetupProjectFileReference`, `SubmitUserEditDiff`, and `SubmitUserEditDiffsPayload`; job types come from `generaltranslation/api`.

`generaltranslation/api` re-exports `@generaltranslation/api`, whose canonical operations and types replace the old generated ones: `awaitJobs(client, projectId, jobIds, options)` polls `queryJobs`, and `ApiClientConfig` has no `projectId`. `generaltranslation/internal` no longer exports the API adapter (`createGtApiAdapter`, `GtApiAdapter`, `GtApiAdapterConfig`); use `GT`.

`GT`, `GTRuntime`, and the new `GTIntl` split credentials, translation, and formatting. Each takes its locales as `localeConfig`, plain data (`{ defaultLocale, locales, customMapping }`, type `LocaleConfig`):

- Project work: `new GT({ apiKey, projectId, sourceLocale, locales, customMapping })` → `new GT({ apiKey, projectId, localeConfig: { defaultLocale, locales, customMapping } })`. With `projectId`, `GT` is project-scoped (type `ProjectHandle`): every project and file method, plus `translate()` and `translateMany()`.
- Account work: `new GT({ apiKey })` without `projectId` is account-scoped: `listOrgs()` and `listProjects()` (new), `account.project(projectId)` (a `ProjectHandle`), and `account.org(orgId)` (an `OrgHandle` with `upsertAssets()` and the new `createProject()`). `upsertAssets()` no longer looks up the project's organization; with only a project: `account.org((await project.get()).orgId)`. A project key (`gtx-api-…`) without `projectId` throws.
- Runtime translation: `new GTRuntime({ apiKey, projectId, targetLocale: 'es' }).translate(source, 'es')` → `new GTRuntime({ apiKey, projectId, localeConfig }).translate(source, 'es')`. `GTRuntime` only translates, and `projectId` is required. The instance `targetLocale` is gone, so JavaScript calls that omitted the target and relied on it now throw; pass the target locale on each call.
- Formatting and locale helpers: `new GT({ targetLocale: 'es', customMapping }).formatNum(n)` → `new GTIntl({ customMapping }, { locale: 'es' }).formatNum(n)`, and `gt.formatNum(n, { locales: ['fr'] })` keeps working as `intl.formatNum(n, { locales: ['fr'] })`. `GTIntl` takes no credentials; `options.locale` overrides its locale for one call. `GT` and `GTRuntime` no longer format or resolve locales, and `LocaleConfig` (from `@generaltranslation/format`) is a type, not a class.
- `GTIntl` methods take the values they act on positionally and an options object last: `gt.requiresTranslation(source, target)` → `intl.requiresTranslation({ locale: target, sourceLocale: source })`, `gt.determineLocale(candidates, approved)` → `intl.determineLocale(candidates, { approvedLocales: approved })`, `gt.getRegionProperties(region)` → `intl.getRegionProperties(region, { locale })`. `getLocaleName`, `getLocaleProperties`, `getLocaleEmoji`, and `getLocaleDirection` describe the target locale when called without one, as before (`gt.getLocaleName()` → `intl.getLocaleName()`), and name locales in the target locale rather than the default locale; `{ locale }` overrides it per call. No method takes a per-call `customMapping`; `standardizeLocale` only normalizes spelling and does not resolve aliases.
- Credentials: `GT` and `GTRuntime` require exactly one of `apiKey` or `userTokenProvider` (type `GTCredentials`) and no longer read `GT_API_KEY` or `GT_PROJECT_ID`: `new GT({ projectId })` → `new GT({ apiKey: process.env.GT_API_KEY!, projectId })`.
- Configuration is fixed at construction: `setConfig()` is removed, and `GT`, `GTRuntime`, their handles, and `GTIntl` copy and freeze the `localeConfig` you pass, including its `locales` array and `customMapping` entries, so later changes to your objects have no effect and the exposed configuration is readonly. `GT`, `GTRuntime`, and handle instances are frozen. Locale codes are no longer validated at construction. A `userTokenProvider` is still asked for a token on each request.
- Constructor types: `GTConstructorParams` is replaced by `GTProjectConfig` (credentials, a required `projectId`, optional `localeConfig` and `baseUrl`), which the project-scoped `GT` and `GTRuntime` take, and `GTAccountConfig` (the same without `projectId`), which the account-scoped `GT` takes. A `projectId` typed `string | undefined` matches neither form; narrow it first.
- `projectId`, `project(id)`, and `org(id)` must be non-empty strings. The `ProjectHandle`, `OrgHandle`, `GTProjectConfig`, `GTAccountConfig`, `GTCredentials`, and `LocaleConfig` types are exported from `generaltranslation`; `generaltranslation/runtime` exports `GTProjectConfig`, `GTCredentials`, and `LocaleConfig`.

API failures throw `ApiError` with the HTTP `status` and the API's error `code` (see `@generaltranslation/api`); local validation and misconfiguration (a missing ID, a project key without `projectId`, and invalid arguments such as repeated move or publish entries) throw a plain `Error` with a diagnostic message.
