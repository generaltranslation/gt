---
'gt-sanity': major
---

Adopt `sanity-plugin-internationalized-array` as the field-level localization engine and add schema-options-based field exclusion.

**Field-level localization is now powered by the reference plugin.** Enabling `fieldLevelLocalization` (or its `internationalizedArray` alias) in `gtPlugin` now auto-configures `sanity-plugin-internationalized-array` from your locales instead of generating gt-sanity's own schema types and Studio UI. Studio behavior (per-language add buttons, language labels, field actions) now always matches the native plugin, and studios that already register the plugin themselves can keep their setup — translation is shape-based and works either way.

**Breaking changes:**

- Removed the `createInternationalizedArrayTypes` export and the `FieldLevelUIComponents` type; gt-sanity no longer ships its own field-level input/item components.
- Removed the `typePrefix`, `includeCompatibilityTypes`, and `components` options from `GTFieldLevelLocalizationConfig` (no native equivalent). Passing them logs a warning and they are ignored. Data created with a custom `typePrefix` is no longer detected; standard `internationalizedArray*` data is unaffected.
- `gt-sanity` now re-exports `internationalizedArray`, `internationalizedArrayLanguageFilter`, and `isInternationalizedArrayItemType` from `sanity-plugin-internationalized-array` for direct use, and `GTFieldLevelLocalizationConfig` gained native passthrough options (`defaultLanguages`, `buttonLocations`, `buttonAddAll`, `languageDisplay`, `apiVersion`).

**New: exclude fields from translation in the schema.** The serializer now honors `options.gt.exclude`, `options.documentInternationalization.exclude` (`@sanity/document-internationalization`), and `options.aiAssist.exclude` (`@sanity/assist`) on field definitions and on type definitions ("field or type", matching the native plugins' semantics), at any nesting depth — no need to maintain a parallel exclusion list in the plugin config. Exclusion via schema options and `localize: false` now also applies to fields of top-level object fields, which were previously not filtered.
