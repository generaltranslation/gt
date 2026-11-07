---
'gt-i18n': patch
---

Move the dictionary (key-based) machinery out of `I18nCache` into a `DictionaryManager` singleton (`initializeDictionaryManager`, `getDictionaryManager`, `setDictionaryManager`) exported from `gt-i18n/internal`. `I18nCache` no longer loads or stores dictionaries, `I18nCacheConstructorParams` no longer accepts `dictionary` or `loadDictionary`, and `I18nCache.resolveCacheLocale()` is now public so the manager composes on the cache's public API. `getTranslations()` and `getTranslationsInternal()` read dictionaries from the manager. The public `gt-i18n` entry is unchanged. Native modules no longer import dictionary code; the bundle win for apps that never use the dictionary API lands when `GTProvider` and `initializeGT()` stop accepting dictionaries.
