---
'gt-i18n': patch
---

Extract the translation batching queue out of `TranslationsCache` into a standalone `BatchingQueue<TItem, TResult>` class, exposed via `gt-i18n/internal`. Behavior unchanged (same defaults: `maxBatchSize=25`, `batchInterval=50ms`, `maxConcurrent=100`). This is the foundation for unifying the duplicated batching implementations in `@generaltranslation/react-core` and `gt-next` in subsequent PRs.
