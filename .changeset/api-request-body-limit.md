---
'@generaltranslation/api': minor
---

Follow the API's one request body limit: every `2026-10-08.v1` request body is at most 4MB. `MAX_REQUEST_BODY_BYTES` is that limit and `jsonByteLength()` measures a value against it. `processBatches()` now closes a batch before its JSON passes the limit; `maxBytes` sets another size, and `byteLength` measures items the request sends in another form. `createBatches()` is exported. In the contract, upload routes no longer have a 4MB limit per inline file and `upsertAssets` results no longer fail with `file_too_large`: a request over the limit is rejected whole with 413.
