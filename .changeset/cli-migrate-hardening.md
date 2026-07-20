---
'gt': patch
---

Harden `gt migrate` based on field testing against the official next-intl example app:

- Preserve static rendering: emit `getLocale.ts` (next/root-params) and `getRegion.ts` when the `[locale]` layout is the root layout, and keep `<html lang>` on the route param instead of request-scoped `getLocale()`, so prerendered (SSG) routes stay prerendered after migration. Apps with a separate root layout get a report TODO with the merge-down path.
- Preserve URL structure: emitted middleware now maps next-intl's `localePrefix` to gt-next (`prefixDefaultLocale: true` for the default 'always' mode), so `/` keeps redirecting to the default locale. 'never' configs skip the middleware file (gt-next middleware would add prefixes those apps avoid) and custom-prefix configs get explicit TODOs.
- Stop skipping files over the `Locale` type: `import { Locale } from 'next-intl'` (a pure type with no gt-next equivalent) no longer skips the whole file; references are rewritten to `string` scope-safely. This previously blocked the provider swap in layouts.
- Degrade spinners to plain lines when output is piped (no more escape-sequence noise in logs).

Close six defects from an external review of the codemod:

- Teardown safety: next-intl stays in package.json when a retained routing/request config file still imports it, and a config file that a retained sibling imports is no longer deleted out from under it.
- Scope-correct provider wiring: the locale injected into a retained `NextIntlClientProvider` now resolves through the provider's own scope, so a locale destructured only in `generateMetadata` is never referenced where it does not exist.
- Unresolved routing values: a `localePrefix` or `pathnames` passed by reference (not a literal) now skips the middleware/navigation conversion with a report entry instead of being read as a default, which could silently change the app's URL structure. A dynamic `localePrefix.prefixes` value now trips the custom-prefix TODO.
- `createNavigation` wrappers with unrecognized shapes register as skips that hold back teardown instead of being silently bypassed; import detection is AST-based and alias-aware.
- Dynamic `getTranslations` namespaces (`{ namespace: expr }`) pass through positionally instead of being dropped to the root namespace; spread object args (`{ ...opts }`) skip the file instead of silently discarding options.
- The `-c/--config` flag is honored for reading and writing gt.config.json.
