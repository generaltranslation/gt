---
'@generaltranslation/react-core': major
---

Each name is now exported from one entry:

- `@generaltranslation/react-core/components-rsc` no longer re-exports what `@generaltranslation/react-core/pure` exports: `t`, `getTranslationsSnapshot`, `getFormatLocales`, `createRenderPipeline`, `RenderPipeline`, `getReactI18nCache`, `setReactI18nCache`, `internalInitializeGTSRA`, `getReadonlyConditionStore`, `RelativeTimeFormatOptions` and `RenderVariable`. Import them from `@generaltranslation/react-core/pure`.
- `I18nStore` is no longer exported from `@generaltranslation/react-core/components`. Import it from `@generaltranslation/react-core/pure`.
