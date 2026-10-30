---
'generaltranslation': major
---

Each name is now exported from one entry, and types are exported from the same entry as their values:

- `generaltranslation/types` is removed. Import its public types, `HTML_CONTENT_PROPS` and `isBinaryFileFormat` from `generaltranslation`. Import `Transformation`, `TransformationPrefix`, `VariableTransformationSuffix` and `InjectionType` from `generaltranslation/internal`. Import `FileFormat`, `RuntimeFileFormat`, `JsonObject` and `JsonValue` from `generaltranslation/api`.
- The unused `EntryActionType` alias is removed.
- `GTRuntime`, `GTProjectConfig` and `GTCredentials` are no longer exported from `generaltranslation`. Use `import { GTRuntime } from 'generaltranslation/runtime'`.
- `LocaleConfig` is no longer exported from `generaltranslation/runtime`. Import it from `generaltranslation`.
- `ModelProvider` is no longer exported from `generaltranslation/internal`. Import it from `generaltranslation/api`.
