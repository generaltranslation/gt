---
'gt-payload': minor
---

Use canonical GT methods. Report per-document source-upload failures and per-translation upload failures while continuing with saved documents.

Custom `GtClient` implementations must replace `enqueueFiles`, `downloadFileBatch`, and `checkJobStatus` with `translateFiles`, `queryFilesContent`, and `queryJobs`. `awaitJobs`, `uploadSourceFiles`, and `uploadTranslations` follow `generaltranslation` 10: `awaitJobs` takes job IDs and returns `{ id, status, error? }` jobs, and uploads return `{ summary, results }`. `GtClient` is the subset of `ProjectHandle` the plugin uses, without `customMapping`: pass `client: new GT({ apiKey, projectId, localeConfig: { customMapping } })` instead of `client: new GT({ apiKey, projectId, customMapping })`. Without an `apiKey` option or `GT_API_KEY`, the run fails with a gt-payload error. The plugin no longer maps job locales back through `customMapping`; a project handle already reports them under the configured codes.
