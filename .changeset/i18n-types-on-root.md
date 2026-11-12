---
'gt-i18n': major
---

Each name is now exported from one entry, and types are exported from the same entry as their values:

- `gt-i18n/types` is removed. Import its types from `gt-i18n`.
- `gt-i18n/internal/types` is removed. Import the dictionary types and `TranslationVariables`, `GTTranslationOptions`, `DictionaryEntryOptions`, `EncodedTranslationOptions`, `JsxTranslationOptions`, `LookupOptionsFor` and `RuntimeTranslationOptions` from `gt-i18n`, and the rest (including `TranslationMetadata`, `TranslationOptions`, `DictionaryLookupOptions`, `LookupOptions` and `NormalizedLookupOptions`) from `gt-i18n/internal`. Import `GTConfig` from `generaltranslation`.
- `getVersionId` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n`.
- `getCookieValue` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/cookies`.
- `isEncodedTranslationOptions` is no longer exported from `gt-i18n/internal`. Import it from `gt-i18n/internal/string`.
- `decodeOptions` is no longer exported from `gt-i18n/internal/string`. Import it from `gt-i18n`.
