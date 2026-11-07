---
'gt': minor
---

Add an experimental `files.gt.msgOutput` option. When set, `gt translate` also writes a copy of each locale's translations file that keeps only entries from `msg()` and `useMessages()`/`getMessages()`, for example `public/_gt/[locale].msg.json`. Apps that embed translations at build time can load it for embedded locales, since `msg()` strings are resolved away from their call sites.
