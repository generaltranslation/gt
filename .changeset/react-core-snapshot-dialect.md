---
"@generaltranslation/react-core": patch
"gt-i18n": patch
---

A lookup in a dialect or alias, such as `gt('Save', { $locale: 'fr-FR' })`, now reads the provider's translations under the locale that serves it (`fr`), as the cache already did. `I18nCache` gains `resolveTranslationLocale()`, which returns that locale.
