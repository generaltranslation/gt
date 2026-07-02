---
'gt-i18n': minor
'gt-react': patch
'gt-tanstack-start': patch
---

Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.

- `gt-i18n`: `I18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName` and exposes getters that fall back to the default cookie names. The default cookie-name constants are now defined in `gt-i18n/internal`.
- `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
- `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.
