---
"gt-next": patch
---

Remove 21 unused error/warning builders from `gt-next`'s `errors/createErrors.ts`.

The following had no consumers anywhere: `createDictionaryTranslationError`, `createInvalidDictionaryEntryWarning`, `createInvalidDictionaryTranslationEntryWarning`, `createInvalidIcuDictionaryEntryError`, `createInvalidIcuDictionaryEntryWarning`, `createMismatchingHashWarning`, `createNoEntryFoundWarning`, `createRequiredPrefixError`, `createStringRenderError`, `createStringRenderWarning`, `createStringTranslationError`, `createTranslationLoadingWarning`, `dictionaryDisabledError`, `dictionaryNotFoundWarning`, `gtProviderUseClientError`, `missingVariablesError`, `noInitGTWarn`, `runtimeTranslationTimeoutWarning`, `txUseClientError`, `unresolvedGetLocaleBuildError`, `usingDefaultsWarning`. ~155 LOC of dead error-string code removed.
