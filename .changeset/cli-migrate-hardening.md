---
'gt': patch
---

Harden `gt migrate` based on field testing against the official next-intl example app:

- Preserve static rendering: emit `getLocale.ts` (next/root-params) and `getRegion.ts` when the `[locale]` layout is the root layout, and keep `<html lang>` on the route param instead of request-scoped `getLocale()`, so prerendered (SSG) routes stay prerendered after migration. Apps with a separate root layout get a report TODO with the merge-down path.
- Preserve URL structure: emitted middleware now maps next-intl's `localePrefix` to gt-next (`prefixDefaultLocale: true` for the default 'always' mode), so `/` keeps redirecting to the default locale. 'never' and custom-prefix configs get explicit TODOs.
- Stop skipping files over the `Locale` type: `import { Locale } from 'next-intl'` (a pure type with no gt-next equivalent) no longer skips the whole file; references are rewritten to `string` scope-safely. This previously blocked the provider swap in layouts.
- Degrade spinners to plain lines when output is piped (no more escape-sequence noise in logs).
