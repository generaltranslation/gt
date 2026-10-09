---
'gt-i18n': patch
---

`resolveSupportedLocale()` and `determineSupportedLocale()` now always accept the default locale when given a one-off locale config, as `I18nConfig` already does. In gt-tanstack-start, a visitor whose browser prefers another locale can now switch to the default locale.
