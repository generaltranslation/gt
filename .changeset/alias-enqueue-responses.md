---
'generaltranslation': patch
---

Restore configured locale aliases in `enqueueFiles()` job results in the GT client and shared API adapter. The adapter also returns aliases in its `locales` list, so CLI staging receives the configured identities while API requests continue to use canonical codes.
