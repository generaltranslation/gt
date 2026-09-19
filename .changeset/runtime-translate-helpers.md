---
'generaltranslation': minor
---

Add named `translate` and `translateMany` helpers to `generaltranslation/runtime` that share the `GT`/`GTRuntime` preparation and wire path without constructing a class, and expose the same methods on the shared tooling API adapter used by the CLI and Sanity. Translation requests now honor a configured custom `fetch`, `apiVersion` and `timeoutMs` (`0` is a literal zero, `false` disables the runtime timer) instead of silently dropping them. Translation still performs no generic retries even when the adapter configures a management `retryPolicy`, and the positional class timeout keeps its existing behavior, where `0` selects the default. Cancellation from a caller signal or custom `fetch` now propagates its original `AbortError` across class, named-helper and adapter translation instead of being reported as an SDK timeout; the timeout diagnostic is raised only when the runtime-owned timer caused the abort.
