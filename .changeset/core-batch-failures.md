---
'generaltranslation': patch
---

Batched writes (`uploadSourceFiles`, `uploadTranslations`, `moveFiles`, `publishFiles`, `overwriteTranslations`, `upsertAssets`) no longer drop the batches the API saved when another batch fails: each item of a failed batch is reported in `results` with `status: 'failed'` and the batch's `error` and `code`, including codes newer than the generated `ErrorCode` list. The error is still thrown when every batch fails, so calls of one batch behave as before.
