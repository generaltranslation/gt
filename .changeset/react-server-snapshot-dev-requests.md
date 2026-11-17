---
'@generaltranslation/react-core': patch
'gt-react': patch
---

When `<GTProvider>` is given `translations`, the server renders only those translations and no longer reads translations the process-wide cache received since, so the server HTML matches the first browser render. With a `cacheExpiryTime` of `0` or one that has expired, `useGT()` and `useMessages()` no longer repeat a development translation request on every render.
