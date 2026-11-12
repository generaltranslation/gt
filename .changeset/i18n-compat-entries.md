---
'gt-i18n': major
---

The dictionary (key-based) API moves to the framework `/compat` entries. The `Dictionary*` types and `TFunctionType` leave the `gt-i18n` root and are exported from `gt-i18n/internal/compat`, beside `getTranslations()` and the new `DictionaryManager` singleton (`initializeDictionaryManager()`, `getDictionaryManager()`, `setDictionaryManager()`, `isDictionaryManagerInitialized()`). `I18nCache` no longer loads or stores dictionaries: `I18nCacheConstructorParams` no longer accepts `dictionary` or `loadDictionary`.

Migration:

| Before | After |
| --- | --- |
| `import type { Dictionary, DictionaryEntry, …, TFunctionType } from 'gt-i18n'` | import the `Dictionary*` types and `TFunctionType` from `gt-i18n/internal/compat`, or the `Dictionary*` types from your framework's `/compat` entry |
