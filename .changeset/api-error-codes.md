---
'@generaltranslation/api': minor
---

`ApiError` carries the API's error code. `status` is the HTTP status (previously `code`), and `code` is the API's machine-readable cause, such as `permission_missing`, or `undefined` when the response has none (for example a gateway error page). The constructor is `new ApiError(message, status, code?)`, replacing `new ApiError(error, code, message)`. Match on `code`, never on `message`, and fall back to `status` for codes you do not recognize; `ErrorCode` lists the known codes.

`isTransientApiError(error)` reports whether a failure may clear on a later read (for example `unavailable` or `rate_limited`). It does not make a write safe to repeat.

`awaitJobs` keeps polling through transient failures until its deadline; their jobs stay pending and the next polls back off. A rate limit the transport could not wait out within one poll waits its `Retry-After` before the next poll. Permanent failures still throw, unless they arrive after the deadline. A 429 `ApiError` carries `retryAfterMs`, the wait the API asked for. Retry waits end as soon as the request's signal aborts, and the transport then returns the last 429 or 5xx response instead of the abort reason.

The bundled spec now includes error codes: `ErrorResponse` is `{ error, code }`, each operation's `<Operation>Error` narrows `code` to the codes it declares, failed batch results and `translateContent` entries carry `code`, and the workspace plugin's translate result lists `failures`. `FileFormat` adds `PNG`, `JPEG` and `MP4`; `ModelProvider` no longer includes `HYPERCLOVA`.
