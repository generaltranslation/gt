---
'gt-tanstack-start': patch
---

fix(tanstack-start): `t()` works during server rendering

`t()` read the locale from a store that the TanStack Start server never set, so server rendering a page that called it failed. The server's request-scoped store now provides the locale, so `t()` translates into the request locale.
