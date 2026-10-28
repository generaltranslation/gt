---
'gt-next': patch
'@generaltranslation/react-core': patch
---

`withGTConfig()` props, `createNextMiddleware()` options and `RenderMethod` now take their types from `GTConfig`, so they match what `gt.config.json` accepts. No behavior changes.
