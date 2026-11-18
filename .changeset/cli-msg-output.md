---
'gt': minor
'generaltranslation': minor
---

Add an experimental `files.gt.inlineTranslations` option with the `locales` to embed at build time. When `inlineTranslations.msgOutput` is set, `gt translate` also writes a copy of each embedded locale's translations file without the entries the compiler embeds at their call sites (`<T>` and messages from the unstable `t`, `useGT()` and `getGT()`), for example `public/_gt/[locale].msg.json`. Apps can load it for embedded locales: it still has every other entry, such as `msg()` and stable `gt()` strings.
