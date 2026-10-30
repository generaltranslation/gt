---
'gt-next': patch
---

Read the i18n config env vars written by `withGTConfig()` through the same parser on the client, the server and the middleware. An unparseable value now logs a diagnostic and falls back to defaults in place of throwing during initialization. An invalid middleware `defaultLocale` now throws a gt-next diagnostic.
