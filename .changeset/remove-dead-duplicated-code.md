---
'gt-i18n': patch
'@generaltranslation/icu': patch
'@generaltranslation/react-core': patch
'gt-vue': patch
'gt-svelte': patch
---

Remove dead and duplicated code. No behavior change.

- `gt-i18n/internal` no longer exports the `CreateGTParams`, `TxConditions`, `TranslationsCacheMissEvent`, `ReadonlyConditionStoreParams` and `GlobalSingleton` types, and its `JsxTranslationOptions` type is renamed `JsxLookupOptions`.
- `@generaltranslation/icu/internal` exports `IntlCache` as a type only; use the `intlCache` instance.
- `gt-vue` uses the shared `isVariable` from `generaltranslation/internal`.
