---
'gt-next': patch
---

`useSetLocale()` now navigates directly to the target locale's URL when switching to a non-default locale, instead of refreshing the current URL and following a middleware redirect. Apps that configure `pathConfig`, `routeOverrides`, or `localeRoutes` keep the middleware redirect.
