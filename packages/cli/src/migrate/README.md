# migrate

`gt migrate` converts an existing i18n setup in a Next.js App Router project to
gt-next. Sources are handled by pluggable adapters behind a common seam; the
source library is auto-detected from your dependencies, or forced with
`--from <library>`.

## Supported sources

| Source        | `--from`        | Status                                      | Scope                                                   |
| ------------- | --------------- | ------------------------------------------- | ------------------------------------------------------- |
| next-intl     | `next-intl`     | full                                        | client + server + config + catalogs (dictionary-compat) |
| react-intl    | `react-intl`    | full                                        | client + RSC + config + catalogs (dictionary-compat)    |
| react-i18next | `react-i18next` | **catalogs + provider + direct call sites** | see below                                               |
| next-i18next  | `next-i18next`  | out                                         | Pages-Router APIs; skipped with a recipe                |
| bare i18next  | —               | out                                         | not a React component integration                       |

> Note: `--from react-i18next` bypasses the Pages-Router refusal by design (it is
> the documented escape hatch for an App Router app whose `app/` directory sits
> in a non-standard location). Because the flag cannot tell a genuine Pages-Router
> app apart from that, forcing it on a real Pages-Router project produces a broken
> migration; the OUT guarantee holds only for the auto-detect path.

Because `determineLibrary` collapses every i18next-family dependency to the
single value `i18next`, **`--from react-i18next` is the reliable way in** for an
i18next project; auto-detect disambiguates react-i18next (App Router) from
next-i18next / bare i18next but the flag removes all doubt.

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

Each source library is a `SourceAdapter` (`adapters/`), so the pipeline stays
library-agnostic and new adapters slot in behind the registry. next-intl
(adapter #1), react-intl / FormatJS (adapter #2), and react-i18next (adapter #3)
are all supported; pass `--from <library>` to override auto-detection.

## react-intl

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

## react-i18next

**v1 converts i18next catalogs to ICU, swaps the provider and config, and
migrates call sites that import `useTranslation`/`Trans` directly from
react-i18next.** Wrapper-based call sites (the official App Router pattern, where
components import their hook from a local `i18n/client`/`i18n/server` module) are
reported and left for manual migration, not silently rewritten. The server side
is not migrated: a raw react-i18next App Router app hand-rolls its server
translation (`getT()` over `initI18next`/`resourcesToBackend`), which is bespoke
per app with no importable symbol to swap, so **every file that imports `i18next`
directly is skipped and reported with a `getTranslations` (gt-next/server) recipe**
rather than miscompiled. The server keeps working on react-i18next until you
migrate it by hand.

Mechanical (converted):

- `useTranslation(ns)` → `useTranslations` (gt-next); `t('key')`, `t('key', {vars})`
- dotted nested keys; `t('ns:key')` remapped to gt's dotted dictionary paths
- `i18n.changeLanguage(l)` → `useSetLocale()`
- `<I18nextProvider>` → `<GTProvider>`; a layout with no provider gets a
  `<GTProvider>` around its `<body>`
- trivial `<Trans i18nKey="…" />` → a dictionary `t()` call

Skipped + reported (actionable):

- `<Trans>` with element children or a `components` prop → rewrite with gt-next
  `<T>` (its children translate in place). Expect this to be common.
- server `getT()` / any direct `i18next` import → migrate to `getTranslations`
- a scoped `useTranslation('ns')` reading another namespace via `ns:key`
- `withTranslation`, `useTranslation().ready`, non-`changeLanguage` `i18n` usage

### Catalog conversion (the core deliverable)

i18next `public/locales/{lng}/{ns}.json` catalogs are converted to ICU and merged
into one dictionary per locale under a NEW `gt/dictionaries/{locale}.json` (the
default namespace at the dictionary root, other namespaces nested). **Originals
are never mutated or overwritten**; the generated `loadDictionary.ts` points at
the new dir. Conversions handled: `{{var}}` → `{var}` with ICU escaping of `{`
`}` `'`; suffix plurals → ICU `plural` using each locale's exact CLDR category
set from `Intl.PluralRules` (so Polish keeps one/few/many/other and Arabic all
six); `_ordinal_` → `selectordinal`; call-site-gated `_context` → `select`;
`number`/`currency` formatters → ICU skeletons; static `$t()` nesting inlined.
Everything non-mechanical (datetime approximated; relativetime/list/custom
formatters, combined context+plural, `returnObjects`/arrays) is left working and
reported. If the app sets `keySeparator: false` or a non-default interpolation
delimiter, the run refuses with a specific diagnostic rather than mis-nesting.

### Known rough edge: the `[lng]` route segment

Real i18next apps localize on a `[lng]` segment, but gt-next's static-rendering
resolver only restores SSG for a segment named literally `[locale]`. Until you
rename `[lng]` → `[locale]`, gt-next has no `getLocale.ts` reading the route
param, so it falls back to its default-locale detection and **every route
renders in the default locale** (verified: on a `[lng]` fixture `/pl/plurals`
renders the English plural). The report surfaces the rename TODO prominently.
Apps already on `[locale]` get the SSG resolvers (`getLocale.ts`/`getRegion.ts`)
emitted and render each locale correctly (verified end to end below).

### Forward-compat (PR #1602)

A future `--keep-i18next-format` mode could emit dictionary leaves as
`[value, { $format: 'I18NEXT' }]` so `{{var}}`/formatters render through
i18next's own interpolation once #1602 ships, instead of converting them to ICU.
v1 does **not** implement it and does **not** depend on #1602: ICU conversion
works today with zero runtime dependency, and plurals/context/nesting must
convert to ICU regardless (they live in i18next's key-lookup layer, which #1602
does not touch).

Known upstream constraints (verified against a real app, 2026-07):

- native-ESM configs (`next.config.mjs`, or `.js` with `"type": "module"`)
  break at build time because gt-next/config's ESM bundle calls bare
  `require` — the command emits a TODO advising a rename to `next.config.ts`.
- runtime `loadDictionary` resolution: with gt-next 11.0.11, the migrated app
  builds and renders correctly under the **Turbopack** build
  (`next build --turbopack`) — verified end to end for react-i18next below. The
  default **webpack** build does not resolve gt-next's internal
  `_load-dictionary` alias (Next externalizes the require from node_modules, so
  the alias never applies), which the gt-next fix from #1909 addresses. Until
  #1909 ships, build with `--turbopack`.

react-i18next end-to-end proof (2026-07, gt-next 11.0.11, Next 15.5): a real
App-Router react-i18next app (en/pl/ar, `common`+`dashboard`, a `[locale]`
segment, a bespoke server `getT`) migrated with `--from react-i18next`,
`next build --turbopack`, then prerendered-HTML inspection. Every plural boundary
matches the pre-migration i18next render exactly — Polish `1/2/5/22` →
`produkt/produkty/produktów/produkty`, Arabic `0/1/2/3/11/100` across all six
CLDR categories — the server `getT` route still renders on react-i18next, and all
routes stay statically prerendered (SSG).
