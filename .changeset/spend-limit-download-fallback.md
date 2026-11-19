---
'gt': patch
---

Add `gt translate --fallback-download`. When a billing limit stops new translations from being queued, the flag downloads existing translations and exits successfully instead of failing. Without the flag, the command still fails, now with an error that names the billing limit.
