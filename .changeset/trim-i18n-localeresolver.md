---
"gt-i18n": patch
---

Remove the unused `condition-store/localeResolver` module from `gt-i18n/internal`.

`determineSupportedLocale`, `resolveSupportedLocale`, and `createLocaleResolver` were thin wrappers over `getI18nConfig().<method>()`. They had no consumers — callers (e.g. tanstack-start) use the `I18nConfig` methods directly via `getI18nConfig()`. Removing the module trims dead indirection from the `/internal` entry; the `LocaleCandidates` type re-export is unaffected (re-exported from its real source).
