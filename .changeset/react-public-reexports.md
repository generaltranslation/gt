---
'gt-react': major
---

`gt-react` no longer exports plumbing that only its sibling framework packages used. Every entry (including `react-server`) drops:

- `createRenderPipeline`, `getFormatLocales`, `getReactI18nCache`, `setReactI18nCache`, `ReactI18nCache`, and the types `RenderPipeline`, `RenderPreparedT`, `ReactI18nCacheParams`: import them from `@generaltranslation/react-core/pure`.
- Types `SyncResolutionFunction` and `SyncResolutionFunctionWithFallback`: import them from `gt-i18n`.

The compiler-injected `GtInternal*` exports stay.
