---
'generaltranslation': patch
'@generaltranslation/format': patch
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-next': patch
'gt-react-native': patch
'gt-tanstack-start': patch
'gt-vue': patch
---

Remove runtime checks that TypeScript already guarantees and duplicated locale resolution. gt-react's browser condition store now resolves the locale once on initialization and server updates, and gt-vue's `initializeGTSPA()` builds its locale matcher once instead of on every lookup. Translation hashes do not change.

Two observable changes:

- `generaltranslation`: runtime translation results from the General Translation API are no longer shape-checked on the client; their type comes from the generated API client. A successful result whose `translation` did not match its `dataFormat` used to become `{ success: false, error: 'Invalid translation returned', code: 500 }`; it is now returned as the service sent it. Failed requests, missing entries (`'No translation returned'`) and network errors behave as before.
- `gt-tanstack-start`: request locales are now resolved against the configuration that `initializeGT()` already loaded, instead of a copy rebuilt on every request. That configuration always includes `defaultLocale` among the supported locales, so with `defaultLocale: 'en'`, `locales: ['fr']` and `Accept-Language: en, fr`, the request locale is now `en` (previously `fr`), matching path-based locale detection.
