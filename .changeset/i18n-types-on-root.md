---
'gt-i18n': major
---

Each name is now exported from one entry, and types are exported from the same entry as their values:

- `gt-i18n/types` is removed. Import its types from `gt-i18n`, except the `Dictionary*` types, `DictionaryEntryOptions` and `TFunctionType`, which moved to `gt-i18n/internal/compat`. The `Dictionary*` types and `DictionaryEntryOptions` are also on the framework `/compat` entries (see the dictionary API changeset).
- `gt-i18n/internal/types` is removed. Import `TranslationVariables`, `GTTranslationOptions`, `EncodedTranslationOptions`, `JsxTranslationOptions`, `LookupOptionsFor` and `RuntimeTranslationOptions` from `gt-i18n`, and the rest (including `TranslationMetadata`, `TranslationOptions`, `LookupOptions` and `NormalizedLookupOptions`) from `gt-i18n/internal`. The dictionary types and `DictionaryEntryOptions` come from `gt-i18n/internal/compat` and the framework `/compat` entries (see the dictionary API changeset); `DictionaryLookupOptions` is no longer exported. Import `GTConfig` from `generaltranslation`.
- `getVersionId` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n`.
- `getCookieValue` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/cookies`.
- `isEncodedTranslationOptions` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/string`.
- `decodeOptions` is no longer exported from `gt-i18n/internal/string`. Import it from `gt-i18n`.
