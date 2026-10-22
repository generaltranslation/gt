---
'generaltranslation': major
---

`GT` calls only the canonical `2026-10-08.v1` API, with project IDs in paths rather than `gt-project-id`. Runtime translation uses `POST /v2/projects/{projectId}/translate`. Batched methods split requests at the server caps: 25 moves, 10 fonts, and 100 for the rest; move lists require disjoint file IDs, and publish lists may name each file version once. Batched writes return `summary` and per-item `results`; a failed item is reported there instead of thrown.

Removed `GT` methods and their replacements:

- `getProjectInfo()`, `getProjectData()` → `getProject()`
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
- `uploadFonts()` → `upsertAssets()`

`updateProject()` and `updateBranch()` are new.

Changed `GT` methods:

- `createBranch()` takes `{ name, isDefault }` only. It returns an existing branch with the same name when the credentials permit the lookup; otherwise the 409 is thrown.
- `awaitJobs(jobIds, options)` takes job IDs only and returns jobs as `{ id, status, subject?, error? }`, with `error` a string. A job the project does not have is `not_found`; `unknown` means the job was not polled before the timeout. `options.onPoll` receives each poll's statuses.
- `uploadSourceFiles()` and `uploadTranslations()` return `{ summary, results }`, without `uploadedFiles`, `count`, or `message`.
- `publishFiles()` returns one result per file version, with each translation's `locale` and `status` under `translations`, and no `success`. `PublishFileEntry` has no `fileName`.
- Job results from `translateFiles()`, `queryJobs()`, `getJob()`, and `awaitJobs()` report `subject.locale` under its `customMapping` alias, like other results.
- `queryFiles()` and `queryFilesContent()` send selectors that resolve to the same file, branch, version, and locale once, and return a result for every selector in order with its requested locale.

`generaltranslation/types` removes `AwaitJobsOptions`, `AwaitJobsResult`, `BranchDataResult`, `BranchQuery`, `CheckJobStatusResult`, `CreateTagOptions`, `CreateTagResult`, `DownloadedFile`, `DownloadFileBatchResult`, `EnqueueFilesOptions`, `EnqueueFilesResult`, `FileDataQuery`, `FileDataResult`, `GetOrphanedFilesResult`, `JobResult`, `JobStatus`, `MoveResult`, `OrphanedFile`, `ProcessMovesResponse`, `SetupProjectFileReference`, `SubmitUserEditDiff`, and `SubmitUserEditDiffsPayload`; job types come from `generaltranslation/api`.

`generaltranslation/api` re-exports `@generaltranslation/api`, whose canonical operations and types replace the old generated ones: `awaitJobs(client, projectId, jobIds, options)` polls `queryJobs`, and `ApiClientConfig` has no `projectId`. The adapter from `generaltranslation/internal` drops the removed operations.
