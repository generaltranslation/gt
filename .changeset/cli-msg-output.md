---
'gt': minor
'generaltranslation': minor
---

Add an experimental `files.gt.inlineTranslations` option with the `locales` to embed at build time. When `inlineTranslations.msgOutput` is set, `gt translate` also writes a copy of each embedded locale's translations file that keeps only entries from `msg()` and `useMessages()`/`getMessages()`, for example `public/_gt/[locale].msg.json`. Apps can load it for embedded locales, since `msg()` strings are resolved away from their call sites.
