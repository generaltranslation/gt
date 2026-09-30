---
'@generaltranslation/api': minor
---

Clients from `createApiClient` now throw an `ApiError` carrying the HTTP status in `code` for failed `throwOnError` calls, including those made by `awaitJobs`, instead of the decoded response body. Non-throwing calls still return the decoded body in `error`. `ApiError` moves to this package; `generaltranslation/errors` re-exports it.
