# migrate

`gt migrate` converts a next-intl or react-intl (FormatJS) Next.js App Router
project to gt-next.

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

## Source libraries

next-intl (adapter #1) and react-intl / FormatJS (adapter #2) are supported;
pass `--from <library>` to override auto-detection. react-i18next is detected by
`determineLibrary` but not yet supported. Each source library is a
`SourceAdapter` (`adapters/`), so the pipeline stays library-agnostic and new
adapters slot in behind the registry.

### react-intl specifics

> A migrated app (next-intl or react-intl alike) will not `next build` on
> published gt-next until #1909 ships; build with `next build --turbopack` to
> verify meanwhile.

Same dictionary-compat strategy. FormatJS catalogs are already in gt's ICU
dialect (gt classifies messages with the same
`@formatjs/icu-messageformat-parser` react-intl uses at runtime), so no
message-format conversion is ever needed. Because react-intl's descriptor-object
call model does not fit the next-intl engine, the adapter supplies its own
per-file transform:

- `useIntl().formatMessage({ id }, values)` becomes `useTranslations()` +
  `t(id, values)`; `<FormattedMessage id values />` becomes `{t(id, values)}`.
  gt resolves the full id, so no namespace/rootId is threaded through. The
  destructured `const { formatMessage } = useIntl()` form is handled too
  (rewritten to `const formatMessage = useTranslations()`), and
  `intl.formatMessage` is resolved through its scope binding so an unrelated
  `intl` prop/param in another scope is never rewritten.
- Catalogs are reused; because gt-next resolves ids as nested dotted paths
  (`id.split('.')`) while react-intl catalogs are flat, dotted flat keys
  (`{"Home.title": …}`) are re-nested into new catalog files (`{Home:{title:…}}`)
  that `loadDictionary` is pointed at, and the originals are never mutated. A key
  that appears both as a leaf and as a namespace (`"a"` and `"a.b"` together)
  cannot be nested, so any file referencing it is skipped and reported.
- `<FormattedNumber>` / `<FormattedDate>` / `<FormattedTime>` /
  `<FormattedPlural>` / `<FormattedRelativeTime>` become `<Num>` / `<DateTime>` /
  `<Plural>` / `<RelativeTime>` (`<FormattedTime>` gets an explicit hour/minute
  default; `updateIntervalInSeconds` has no live-tick equivalent and is dropped
  with a TODO).
- `<IntlProvider>` is unwrapped so the `[locale]` layout's `<GTProvider>` owns
  the context; RSC `createIntl(...).formatMessage` becomes
  `await getTranslations()`; `defineMessages` with literal descriptors is
  inlined; the FormatJS build plugin (`@formatjs/swc-plugin`) is torn down in
  `next.config`.
- The id problem: when only non-default locales ship a compiled catalog (English
  served from inline `defaultMessage`), the adapter harvests the literal
  `defaultMessage`s and synthesizes a new default-locale catalog file. When the
  default catalog exists but is missing some ids (a partial extraction), each
  missing id is filled per-id from its inline `defaultMessage` into a new file
  instead of skipping the whole file. Existing catalogs are never mutated (new
  files only). A conversion is skipped and reported when the id has no
  default-locale source entry (gt-next's dictionary `t()` throws on unknown
  keys), and when one id has conflicting `defaultMessage` variants across the
  source, the report lists every variant and the winner so they can be
  reconciled.
- Auto-generated ids are not converted in v1: the FormatJS-recommended workflow
  writes a `defaultMessage` with no literal `id` and hashes the id at build time
  (`overrideIdFn` / `idInterpolationPattern`). gt-next needs a literal id per
  message, so files written that way are skipped with one top-level warning
  naming the real cause; add explicit `id`s (or convert those files by hand),
  then re-run.

Left for manual migration (skipped whole, reported, react-intl kept installed):
class-component `injectIntl`, bare-module `createIntl` / `createIntlCache`,
`RawIntlProvider`, `IntlProvider` `defaultRichTextElements` / global
`formats` / `timeZone` / `textComponent` / `onError`, `<FormattedList>`,
`<FormattedDisplayName>`, `*ToParts`, render-prop `<FormattedMessage>` children,
non-trivial rich-text chunk functions (and JSX-element `values`), dynamic ids and
FormatJS auto-generated ids (see above), flat/nested key collisions, and
AST-compiled (`--ast`) catalogs. Rich-text tags in messages render only under `--inline`
(converted to inline `<T>`), and every inlined key is reported as needing
`npx gt translate` because gt hashes source differently from FormatJS's
`[sha512:contenthash]`, so existing FormatJS-keyed translations do not match.

Known upstream constraints (verified against a real app, 2026-07):

- native-ESM configs (`next.config.mjs`, or `.js` with `"type": "module"`)
  break at build time because gt-next/config's ESM bundle calls bare
  `require` — the command emits a TODO advising a rename to `next.config.ts`.
- runtime `loadDictionary` resolution in webpack builds needs the gt-next fix
  from #1909; with it, both migration modes build and serve cleanly.
