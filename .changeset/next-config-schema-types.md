---
'gt-next': patch
'@generaltranslation/react-core': patch
---

`withGTConfig()` props, `createNextMiddleware()` options and `RenderMethod` now take their types from the `gt.config.json` schemas: the shared keys from `GTConfig`, and gt-next's routing keys (`pathConfig`, `pathRegex`, `prefixDefaultLocale` and the others) from gt-next's own schema, so they match what `gt.config.json` accepts. No behavior changes.
