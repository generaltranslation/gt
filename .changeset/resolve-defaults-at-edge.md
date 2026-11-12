---
'gt-i18n': major
'@generaltranslation/api': patch
'generaltranslation': patch
'gt-tanstack-start': patch
'@generaltranslation/compiler': patch
'gt-sanity': patch
---

Resolve option defaults once, where the options are accepted, and pass required values to the code below. No behaviour change for apps.

- `@generaltranslation/api` exports `DEFAULT_TIMEOUT_MS`, the default request timeout.
- `gt-i18n/internal`: `I18nConfig`'s `resolveSupportedLocale(candidates)` no longer takes a config override and uses the configuration GT was initialized with. `determineSupportedLocale(candidates)` is removed; use `determineLocale(candidates)`, which matches the same way. `LocaleResolverConfig` is no longer exported.
- `gt-i18n/internal/compat`: `new DictionaryManager()` takes a config with `dictionary`, `loadDictionary` and `cacheExpiryTime` all set. `initializeDictionaryManager()` still accepts the optional params and fills in the defaults.
