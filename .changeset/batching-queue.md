---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-next': patch
---

Unify the translation batching queue across `gt-i18n`, `@generaltranslation/react-core`, and `gt-next`. Pulls the queue/timer/concurrency logic out of three independent reimplementations into a single `BatchingQueue<TItem, TResult>` class exposed via `gt-i18n/internal`. Same defaults (`maxBatchSize=25`, `batchInterval=50ms`, `maxConcurrent=100`).

Behavior note: `react-core` and `gt-next` previously processed batches sequentially despite the `maxConcurrent=100` constant — an artifact of their implementations rather than an explicit design choice. They now fan out batches concurrently up to that cap, matching `gt-i18n`'s long-standing behavior. `gt-next` also no longer runs a permanent `setInterval` polling the queue; the queue self-schedules only when work exists.
