# migrate

`gt migrate` converts a next-intl Next.js App Router project to gt-next.

Strategy: **dictionary-compat by default** — gt-next's `useTranslations`/
`getTranslations` share next-intl's names, namespace resolution, and ICU
interpolation, so most call sites survive an import swap. Existing per-locale
catalogs keep working through a generated `loadDictionary.ts` (no
re-translation). `--inline` additionally converts pure-static-text `t('key')`
calls in JSX-child position to inline `<T>` content.

Files using APIs with no gt-next equivalent (`useFormatter`, `t.raw`, complex
`t.rich`, …) are **skipped whole**; while any exist, next-intl stays installed,
`createNextIntlPlugin` stays composed around `withGTConfig` (the retained
provider needs its request-config alias), and `NextIntlClientProvider` renders
nested inside `GTProvider` with an explicit `locale={await getLocale()}` so
skipped components stay on the page's locale. The report
(`gt-migrate-report.md`) lists every skip and TODO — nothing is dropped
silently. On a full migration the routing/request config files are deleted
only when nothing still imports them (`routing.locales` in
generateStaticParams is inlined first); `gt-next` is installed with the
project's package manager when missing.

Pipeline (see `../cli/commands/migrate.ts`): `parseRoutingConfig` →
`discoverCatalogs` → `transformSource` over source files → `transformNavigation`
(createNavigation wrappers) → `transformLayout` (last: needs the final skip set)
→ `transformNextConfig` + `transformMiddleware` → `emitGtFiles` (gt.config.json,
loadDictionary.ts, package.json, teardown) → buffered write + report.
All transforms are babel parse/traverse/generate (`retainLines`) like the
existing wizard codemods; `--dry-run` prints the report without writing.

react-i18next is detected (`determineLibrary`) but not yet supported — the
transforms take the library as a parameter so an adapter can slot in.

Known upstream constraints (verified against a real app, 2026-07):

- native-ESM configs (`next.config.mjs`, or `.js` with `"type": "module"`)
  break at build time because gt-next/config's ESM bundle calls bare
  `require` — the command emits a TODO advising a rename to `next.config.ts`.
- runtime `loadDictionary` resolution in webpack builds needs the gt-next fix
  from #1909; with it, both migration modes build and serve cleanly.
