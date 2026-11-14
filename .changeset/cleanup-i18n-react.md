---
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-tanstack-start': patch
---

Remove duplicate and unused type exports.

- `import type { UseTranslationsFunction } from 'gt-react/compat'` (also `gt-react-native/compat` and `gt-tanstack-start/compat`): use `TFunctionType` from the same entry. From `gt-next/compat`, use `TFunctionType` from `gt-next/compat/server`; from `@generaltranslation/react-core/compat`, use `TFunctionType` from `gt-i18n/internal/compat`.
- `@generaltranslation/react-core/pure` no longer exports the `OnMissingTranslation` and `VariableProps` types.
- `@generaltranslation/react-core/components-rsc` no longer exports the `RenderDefaultChildrenArgs`, `RenderPreparedTParams` and `RenderTranslatedChildrenArgs` types.
- `I18nCacheConfig` from `gt-i18n/internal` no longer has `projectId`, `apiKey` and `runtimeUrl`; `I18nCache` never read them.
