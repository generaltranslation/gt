---
'gt-payload': minor
---

Use canonical GT methods. Report per-document source-upload failures and per-translation upload failures while continuing with saved documents.

When billing stops a translation, the admin panel names the cause: the plan's usage limit, the spend limit, the credit balance, or billing that needs attention. `TranslateResult.usageLimitReached` is replaced by `billingCode` (the API's 402 error code), and the runs collection's `usageLimitReached` field by `billingCode`; on Postgres or SQLite run `payload migrate:create` to replace the column. Failed plugin requests return the API error `code` with `error`, and the admin panel advises trying again only for failures that may clear.

Custom `GtClient` implementations must replace `enqueueFiles`, `downloadFileBatch`, and `checkJobStatus` with `translateFiles`, `queryFilesContent`, and `queryJobs`. `awaitJobs`, `uploadSourceFiles`, and `uploadTranslations` follow `generaltranslation` 10: `awaitJobs` takes job IDs and returns `{ id, status, error? }` jobs, and uploads return `{ summary, results }`. `GtClient` is the subset of `ProjectHandle` the plugin uses, without `customMapping`: pass `client: new GT({ apiKey, projectId, localeConfig: { customMapping } })` instead of `client: new GT({ apiKey, projectId, customMapping })`. Without an `apiKey` option or `GT_API_KEY`, the run fails with a gt-payload error. The plugin no longer maps job locales back through `customMapping`; a project handle already reports them under the configured codes.
