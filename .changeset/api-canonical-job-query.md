---
'@generaltranslation/api': minor
---

Move to `2026-10-08.v1` and replace legacy generated operations with canonical ones. `createApiClient` no longer accepts `projectId` or sends `gt-project-id`; project-scoped operations use `path.projectId`. Its default version header is `apiVersion ?? API_VERSION`.

`awaitJobs(client, projectId, jobIds, options)` polls `queryJobs` in batches of 100 with the pinned `API_VERSION`. Results use `{ id, status, subject?, error? }`; `not_found` is terminal and `unknown` means no status was received before the deadline. `queryJobsInBatches` is also available for batched status reads.

Wait for translation jobs before reading files: unstored translations return `not_found` (404 for single reads); stored but incomplete translations return `pending` and should be read again later.
