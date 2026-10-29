---
'@generaltranslation/react-core-linter': minor
---

Add the `translation-function-placement` rule, on in the recommended config. It reports `getGT()`, `getMessages()`, `getLocale()` and `getEnableI18n()` from `gt-tanstack-start`, and `getTranslations()` from `gt-tanstack-start/compat`, called at module scope, where a server reuses the first request's locale for every later request, or in a component or hook, which should use `useGT()` and the other hooks instead. The other rules now also check imports from `gt-tanstack-start`.
