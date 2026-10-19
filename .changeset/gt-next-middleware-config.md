---
'gt-next': patch
---

`withGTConfig()` now accepts the `createNextMiddleware()` routing options (`localeRouting`, `prefixDefaultLocale`, `enableSmartRouting`, `ignoreSourceMaps`, `pathConfig`, `routeOverrides`, `localeRoutes`). Options passed directly to `createNextMiddleware()` still take precedence.
