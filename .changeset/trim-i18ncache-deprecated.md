---
"gt-i18n": patch
---

Remove deprecated methods from `gt-i18n`'s `I18nCache`.

Dropped the long-`@deprecated` cache methods that duplicated `I18nConfig`/loader APIs: `getDefaultLocale`, `getLocales`, `getCustomMapping`, `getGTClass`, `getTranslationLoader`, `resolveTranslationSync`, `getTranslations`, and `getTranslationResolver`. None were called anywhere (consumers use `getI18nConfig()` / `lookupTranslation` / `loadTranslations`). Removes the methods, their now-unused imports, and the tests that covered them.
