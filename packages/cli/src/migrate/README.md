# migrate

`gt migrate` converts a next-intl Next.js App Router project to gt-next.

Strategy: **dictionary-compat by default** — gt-next's `useTranslations`/
`getTranslations` share next-intl's names, namespace resolution, and ICU
interpolation, so most call sites survive an import swap. Existing per-locale
catalogs keep working through a generated `loadDictionary.ts` (no
re-translation). `--inline` additionally converts pure-static-text `t('key')`
calls in JSX-child position to inline `<T>` content.

Files using APIs with no gt-next equivalent (`useFormatter`, `t.raw`, complex
`t.rich`, …) are **skipped whole**; while any exist, next-intl stays installed
and `NextIntlClientProvider` renders nested inside `GTProvider` so the app
works mid-migration. The report (`gt-migrate-report.md`) lists every skip and
TODO — nothing is dropped silently.

Pipeline (see `../cli/commands/migrate.ts`): `parseRoutingConfig` →
`discoverCatalogs` → `transformSource` over source files → `transformNavigation`
(createNavigation wrappers) → `transformLayout` (last: needs the final skip set)
→ `transformNextConfig` + `transformMiddleware` → `emitGtFiles` (gt.config.json,
loadDictionary.ts, package.json, teardown) → buffered write + report.
All transforms are babel parse/traverse/generate (`retainLines`) like the
existing wizard codemods; `--dry-run` prints the report without writing.

react-i18next is detected (`determineLibrary`) but not yet supported — the
transforms take the library as a parameter so an adapter can slot in.
