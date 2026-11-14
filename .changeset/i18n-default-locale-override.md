---
'gt-i18n': patch
---

`I18nConfig`'s `determineLocale()` and `resolveSupportedLocale()` always accept the configured default locale, even when `locales` does not list it. In gt-tanstack-start, a visitor whose browser prefers another locale can now switch to the default locale.
