---
"gt-next": patch
---

Remove the deprecated SSG and experimental-locale-resolution code paths from `gt-next`.

Drops the long-deprecated, runtime-dead config surface: `experimentalEnableSSG`, `experimentalLocaleResolution`/`experimentalLocaleResolutionParam`, the static request functions (`STATIC_REQUEST_FUNCTIONS`/`getStatic*` and their non-existent `internal/static/*` aliases), and `disableSSGWarnings`/`getStatic*Path` doc props. Removes `plugin/checks/ssgChecks.ts`, the experimental branch of `cacheComponentsChecks`, the related error/warning builders, and the corresponding build-time env vars (`_GENERALTRANSLATION_ENABLE_SSG`, `_GENERALTRANSLATION_EXPERIMENTAL_LOCALE_RESOLUTION[_PARAM]`, `_GENERALTRANSLATION_STATIC_GET_*_ENABLED`) — none of which were read at runtime. The live cacheComponents checks and `noLocalesCouldBeDeterminedWarning` are retained.
