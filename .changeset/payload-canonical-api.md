---
'gt-payload': minor
---

Use canonical GT methods. Report per-document source-upload failures and per-translation upload failures while continuing with saved documents.

When billing stops a translation (HTTP 402), the admin panel shows the API's message with a hint for where to fix it in the dashboard. `TranslateResult.usageLimitReached` is replaced by `billingError` (`{ message, code? }`, the API's 402 message and error code as sent), and the runs collection's `usageLimitReached` field by the text fields `billingMessage` and `billingCode`; on Postgres or SQLite run `payload migrate:create` to replace the column. Failed plugin requests return the API error `code` with `error`, and the admin panel advises trying again only for failures that may clear.

Custom `GtClient` implementations must replace `enqueueFiles`, `downloadFileBatch`, and `checkJobStatus` with `translateFiles`, `queryFilesContent`, and `queryJobs`. `awaitJobs`, `uploadSourceFiles`, and `uploadTranslations` follow `generaltranslation` 10: `awaitJobs` takes job IDs and returns `{ id, status, error? }` jobs, and uploads return `{ summary, results }`. `GtClient` is the subset of `ProjectHandle` the plugin uses, without `customMapping`: pass `client: new GeneralTranslation({ apiKey, projectId, localeConfig: { customMapping } })` instead of `client: new GT({ apiKey, projectId, customMapping })`. Without an `apiKey` option or `GT_API_KEY`, the run fails with a gt-payload error. The plugin no longer maps job locales back through `customMapping`; a project handle already reports them under the configured codes.
