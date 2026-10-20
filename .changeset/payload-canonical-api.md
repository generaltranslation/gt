---
'gt-payload': minor
---

Use canonical GT methods. Report per-document source-upload failures and per-translation upload failures while continuing with saved documents.

Custom `GtClient` implementations must replace `enqueueFiles`, `downloadFileBatch`, and `checkJobStatus` with `translateFiles`, `queryFilesContent`, and `queryJobs`. `awaitJobs`, `uploadSourceFiles`, and `uploadTranslations` follow `generaltranslation` 10: `awaitJobs` takes job IDs and returns `{ id, status, error? }` jobs, and uploads return `{ summary, results }`. A `GT` instance from `generaltranslation` 10 satisfies `GtClient`.
