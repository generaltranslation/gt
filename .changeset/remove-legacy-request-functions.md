---
"gt-next": patch
---

Remove the legacy SSG request-function resolution path. `getLocale()` and `getRegion()` now always resolve through `getRequestFunction`, and the unused `legacyGetLocaleFunction`, `legacyGetRegionFunction`, `legacyGetRequestFunction`, and `isSSR` internals (plus their SSG-only warning helpers) have been deleted.
