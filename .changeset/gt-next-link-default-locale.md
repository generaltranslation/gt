---
'gt-next': patch
---

`gt-next/link` no longer prefixes default-locale links when `prefixDefaultLocale` is `false`, avoiding a middleware redirect. Explicit `locale` props for the default locale stay prefixed unless `enableSmartRouting` is `false`. Set these options in `withGTConfig()` so Link can read them; `createNextMiddleware()` warns in development when its values differ.
