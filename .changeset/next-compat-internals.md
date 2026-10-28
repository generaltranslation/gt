---
'gt-next': patch
---

`NextI18nCache` no longer loads dictionaries. The `gt-next/internal/_dictionary` and `_load-dictionary` aliases are now required only from compat modules, which `GTProvider`, `getTranslations()` and `useTranslations()` use. The webpack rule that parses gt-next's ESM dist as `javascript/auto` now detects the dist through `internal/_load-translations.mjs`. No public API change. Native-only imports no longer bundle the dictionary machinery: importing `T`, `useGT`, `useMessages` and `Var` is about 1.3 kB (client) and 1.5 kB (RSC) smaller, minified and brotlied.
