---
'gt-sanity': major
---

Remove the remaining backward compatibility:

- The `internationalizedArray` plugin option is removed; use `fieldLevelLocalization`.
- The legacy object-keyed `'field'` translation level is removed: `BaseDocumentSerializer(schema).serializeDocument(doc, stopTypes?, serializers?)` no longer takes `translationLevel` or `baseLang`, and `BaseDocumentMerger.fieldLevelMerge` and `languageObjectFieldFilter` are removed. Use `translationLevel: 'internationalizedArray'`.
- The Translations Tab types `Adapter`, `ExportForTranslation`, `ImportTranslation`, and `TranslationsTabConfigOptions` are no longer exported, and the unused Translations Tab adapter and configuration modules are removed.
- The warning for the field-level options removed in 3.0.0 (`typePrefix`, `includeCompatibilityTypes`, `components`) is removed.
- `GTPluginConfig` no longer accepts `devApiKey`; use `apiKey`.
