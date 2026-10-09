---
'gt-tanstack-start': patch
---

`gtMiddleware` is now optional. Without it, server APIs such as `getLocale()` and `getGT()` resolve the locale once per request from TanStack Start's own request context, and `parseLocale()` returns the same locale. Without `gtMiddleware`, read the locale before rendering, for example by calling `getLocale()` or `parseLocale()` in the root route loader, so the locale cookie is sent with the response headers. A first read inside deferred or streamed content runs after the headers are sent. gt-tanstack-start also exports the components the GT compiler injects, so the compiler's automatic JSX injection works with imports from `gt-tanstack-start`.
