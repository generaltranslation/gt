---
"gt-next": patch
---

Support Next.js's function-form config in `withGTConfig`. When passed a `(phase, context) => NextConfig` function (Next's function config form), `withGTConfig` now calls it and wraps the resolved config instead of spreading the function as a plain object. This lets `withGTConfig` compose with other Next config plugins that return a config function — matching `@sentry/nextjs`'s `withSentryConfig` — for both sync and async config functions.
