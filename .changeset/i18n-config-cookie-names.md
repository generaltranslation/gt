---
'gt-i18n': minor
'@generaltranslation/react-core': patch
'gt-next': patch
'gt-react': patch
'gt-react-native': patch
'gt-tanstack-start': patch
---

Store cookie names in I18nConfig so custom cookie names work before the condition store is initialized.

- `gt-i18n`: Removed the unused React locale cookie name from the shared GT config type.
- `@generaltranslation/react-core`: `ReactI18nConfig` now accepts `localeCookieName`, `regionCookieName`, and `enableI18nCookieName`, exposes getters that fall back to the default names, and exports the default storage names from the `pure` entrypoint.
- `gt-next`: Imports default cookie names from the React Core `pure` entrypoint instead of the removed React Core cookie constants subpath.
- `gt-react`: The browser condition store now resolves cookie names from `I18nConfig` instead of hardcoding the defaults, so custom cookie names passed to `initializeGT()` are honored for both reads and writes.
- `gt-react-native`: Native condition storage now resolves its store keys from `I18nConfig`, matching `gt-react` behavior.
- `gt-tanstack-start`: `parseLocale()` reads and writes the locale cookie using the configured cookie name instead of the default.
