---
"@generaltranslation/react-core": patch
---

Remove the unused dictionary-injection helpers from `@generaltranslation/react-core/pure`.

`collectUntranslatedEntries`, `injectAndMerge`, `injectEntry`, `injectFallbacks`, `injectHashes`, `injectTranslations`, `getSubtree`, `getSubtreeWithCreation`, and `stripMetadataFromEntries` were a self-referential cluster with no consumers anywhere in the library or its packages. Removing them (and their modules/tests) trims ~415 LOC of dead code from the client-shipped `/pure` entry. The still-used dictionary helpers (`getDictionaryEntry`, `getEntryAndMetadata`, `mergeDictionaries`, `flattenDictionary`, `indexDict`, `isDictionaryEntry`) are unchanged.
