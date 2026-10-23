---
'@generaltranslation/api': patch
---

Abort timed-out requests reliably. `createTimeoutFetch` now passes its abort signal to `fetch` in the request init as well as on the copied `Request`, so the `timeoutMs` timeout fires in Node even if garbage collection runs while the request is pending, and custom `fetch` implementations that read only `request.signal` still see it. The timeout aborts with its own `Request timed out after <ms>ms` error, so a custom `fetch` that rejects with its own error after the timeout keeps that error.
