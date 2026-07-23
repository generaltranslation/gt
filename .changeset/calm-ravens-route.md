---
'generaltranslation': patch
'gt-tanstack-start': minor
---

Add opt-in locale routing for TanStack Start. Setting `localeRouting` in `gt.config.json` makes `gtMiddleware` prioritize locale path prefixes and updates client locale changes to keep the pathname in sync while leaving the default locale unprefixed.
