---
'generaltranslation': minor
---

Route the `GT` project and file methods through the generated OpenAPI SDK while preserving their published signatures. Requests now use the SDK's idempotency-aware retry policy, so POST requests are no longer retried automatically after network errors or server failures; rate-limit (429) responses are still retried for every method. Remove the stale `deduped` field from uploaded font results because the server has never returned it.
