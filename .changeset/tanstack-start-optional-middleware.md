---
'gt-tanstack-start': patch
---

Server APIs such as `getLocale()` and `getGT()` resolve the locale once per request from TanStack Start's own request context. gt-tanstack-start also exports the components the GT compiler injects, so the compiler's automatic JSX injection works with imports from `gt-tanstack-start`.
