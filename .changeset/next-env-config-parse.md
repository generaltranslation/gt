---
'gt-next': patch
---

Read the i18n config env vars written by `withGTConfig()` through the same parser on the client, the server and the middleware. An invalid middleware `defaultLocale` now throws a gt-next diagnostic.
