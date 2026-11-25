---
'gt-i18n': major
---

Each name is now exported from one entry, and types are exported from the same entry as their values:

- `gt-i18n/types` is removed. Import `GTFunctionType`, `MFunctionType`, `RegisterableMessages`, `GTTranslationOptions` and `EncodedTranslationOptions` from `gt-i18n/internal/string`, and `TranslationVariables` and `JsxLookupOptions` (formerly `JsxTranslationOptions`) from `gt-i18n/internal`. The `Dictionary*` types, `DictionaryEntryOptions` and `TFunctionType` moved to `gt-i18n/internal/compat`; the `Dictionary*` types and `DictionaryEntryOptions` are also on the framework `/compat` entries (see the dictionary API changeset). `SyncResolutionFunction`, `SyncResolutionFunctionWithFallback`, `RegisteredMessage`, `LookupOptionsFor` and `RuntimeTranslationOptions` are removed with the string functions (see the tagged-template API changeset).
- `gt-i18n/internal/types` is removed. Import `GTTranslationOptions` and `EncodedTranslationOptions` from `gt-i18n/internal/string`, and the rest (including `TranslationVariables`, `JsxLookupOptions`, `TranslationMetadata`, `TranslationOptions`, `LookupOptions` and `NormalizedLookupOptions`) from `gt-i18n/internal`; `LookupOptionsFor` and `RuntimeTranslationOptions` are removed. The dictionary types and `DictionaryEntryOptions` come from `gt-i18n/internal/compat` and the framework `/compat` entries (see the dictionary API changeset); `DictionaryLookupOptions` is no longer exported. Import `GTConfig` from `generaltranslation`. `JsxTranslationOptions` is renamed `JsxLookupOptions`.
- `getVersionId` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n`.
- `getCookieValue` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/cookies`.
- `isEncodedTranslationOptions` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/string`.
