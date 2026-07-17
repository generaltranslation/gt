# migrate

`gt migrate` converts a next-intl Next.js App Router project to gt-next.

Strategy: **dictionary-compat by default** — gt-next's `useTranslations`/
`getTranslations` share next-intl's names, namespace resolution, and ICU
interpolation, so most call sites survive an import swap. Existing per-locale
catalogs keep working through a generated `loadDictionary.ts` (no
re-translation). The default mode never embeds source text: transforms that
would orphan existing translations (`t.rich` → `<T>`, static `t('key')`
inlining) run only under `--inline`, which reports every affected key as
needing regeneration (`npx gt translate`).

Files using APIs with no gt-next equivalent (`useFormatter`, `t.raw`, …) are
**skipped whole**; while any exist, next-intl stays installed,
`createNextIntlPlugin` stays composed around `withGTConfig`, the request
config's `requestLocale` fallback is rewired through gt-next's `getLocale()`
(so skipped files — client and server — resolve the page locale, not the
default), and `NextIntlClientProvider` renders nested inside `GTProvider` with
an explicit `locale`. The report (`gt-migrate-report.md`) lists every skip and
TODO — nothing is dropped silently.

Scope is decoupled from safety: the scan covers `src/app/pages/components`
plus `i18n/**` and wherever the routing/request config lives, but teardown
decisions consult **every** source file in the project — anything outside the
scan (an explicit `--src`, an unconventional directory) that still imports
next-intl counts as a skip and blocks the teardown. On a full migration the
routing/request config files are deleted only when nothing still imports them
(`routing.locales` in generateStaticParams is inlined first); `gt-next` is
installed with the project's package manager when missing.

Navigation wrappers: `Link` re-exports from `gt-next/link`; `usePathname`
becomes a locale-prefix-stripping wrapper (next-intl's returns the pathname
without the prefix); `redirect`/`useRouter` pass through `next/navigation`
with a TODO. Routing configs with localized `pathnames` skip the navigation
file whole — gt-next does not localize path segments.

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
