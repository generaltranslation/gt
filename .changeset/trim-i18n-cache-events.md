---
"gt-i18n": patch
---

Remove deprecated i18n cache lifecycle hooks and unused cache events.

The cache subscription surface now only exposes `translations-cache-miss`, which is used for runtime translation updates. Deprecated lifecycle constructor callbacks and unused locale/dictionary cache hit/miss events have been removed.
