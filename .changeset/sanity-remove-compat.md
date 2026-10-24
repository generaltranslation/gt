---
'gt-sanity': major
---

Remove the remaining backward compatibility:

- The `internationalizedArray` plugin option is removed; use `fieldLevelLocalization`.
- The legacy object-keyed `'field'` translation level is removed: `BaseDocumentSerializer(schema).serializeDocument(doc, stopTypes?, serializers?)` no longer takes `translationLevel` or `baseLang`, and `BaseDocumentMerger.fieldLevelMerge` and `languageObjectFieldFilter` are removed. Use `translationLevel: 'internationalizedArray'`.
- The Translations Tab types `Adapter`, `ExportForTranslation`, `ImportTranslation`, and `TranslationsTabConfigOptions` are no longer exported, and the unused Translations Tab adapter and configuration modules are removed.
- The warning for the field-level options removed in 3.0.0 (`typePrefix`, `includeCompatibilityTypes`, `components`) is removed.
- `GTPluginConfig` no longer accepts `devApiKey`, `apiKey`, `userTokenProvider`, `baseUrl`, or `targetLocale`; the API key comes from the Studio secrets, and the others had no effect.
- `GTPluginConfig` no longer accepts `projectId`, which had no effect; the project comes from the Studio secrets. Each request builds a project-scoped `new GT({ apiKey: secrets.secret, projectId: secrets.project })`; a missing API key secret fails with a gt-sanity error. Locale labels use a credential-free `GTIntl`.
