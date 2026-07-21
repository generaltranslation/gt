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

Review-response round:

- `gt migrate` requires an explicit `--from <library>` flag ('next-intl' today; react-i18next is planned) and the command description is library-neutral.
- When catalog detection comes up empty in an interactive session, the command asks for the messages directory, supported locales, and default locale (the same prompts `gt setup` uses) instead of failing outright; non-interactive runs keep the hard error.
- The `--inline` opt-in pass was removed to keep the first version small; `t.rich` files now always skip with a report entry pointing at manual conversion. Inline conversion returns as a follow-up PR.
- Catalog discovery uses `libraryDefaultLocale` instead of a hardcoded 'en' and reports malformed catalogs through the standard diagnostic message format.

Fourth review round:

- Layouts are classified to a fixed point before any is rewritten, so a nested layout that must be skipped keeps `NextIntlClientProvider` in the already-converted root layout above it (previously a later layout skip could arrive after the root layout had dropped the provider).
- Catalog discovery fails loudly when the routing config lists a locale with no catalog file (warning names the missing locales, then the interactive prompts or the hard error take over) instead of silently writing a gt.config.json without it.
- Removing an orphaned `const { locale } = await params` also removes the now-unused `params` parameter binding, so migrated layouts with a static `<html lang>` pass no-unused-vars linting.
- The catalog-fallback warnings and errors go through `createDiagnosticMessage`, with caught parse errors carried in the details slot.
- Pages get the same orphan hygiene as layouts: removing `setRequestLocale(locale)` now also removes a `const { locale } = use(params)` (or `await params`) destructure it stranded, the unused `params` parameter, and a dangling react `use` import, so migrated pages pass strict unused-variable linting too. Layouts keep their own cleanup (their param binding can be re-referenced by retained-provider wiring).
- A filesystem failure while applying the buffered edits (permissions, disk full) now exits with a diagnostic naming how many changes landed, which files were already rewritten, and the `git checkout .` recovery path, instead of surfacing a raw stack trace over a partially migrated project.
- On a full migration, a `const locale = await getLocale()` whose only consumer was the stripped provider `locale` attribute is removed along with its swapped import (a locale still read elsewhere keeps both), closing the same unused-variable leak in provider files.
