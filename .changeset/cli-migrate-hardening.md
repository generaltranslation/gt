---
'gt': patch
'@generaltranslation/migrate': patch
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
- Provider props beyond `messages` and `locale` (timeZone, formats, onError, ...) are no longer dropped silently in the GTProvider swap: the report gets a TODO naming them, since they carried behavior that needs a gt-next equivalent.
- The React 19 `use(params)` destructure form is recognized everywhere `await params` is: layout guard-removal cleans its orphan (destructure, `params` parameter, stranded react `use` import), and a retained provider takes its `locale` from that binding instead of falling back to a request-scoped `getLocale()`.

Consolidation recheck round (fresh end-to-end review of the combined PR):

- A locale guard is removed only when every locale list it tests provably matches the full configured-locale set (`hasLocale`, a locales-named config array, or a literal array matching the configured locales exactly). A guard testing the locale against a different list (a launch subset, a blocklist) is kept with a report entry, since gt-next serves every configured locale and removing it would change routing behavior. A removed guard's now-unused const array is pruned with it. (Unchanged from before: a guard mixing locale validation with unrelated conditions in one if statement is still removed whole.)
- The config lane (next.config, middleware) is classified for skips before provider retention is decided, so a middleware-only skip yields a coherent partial migration: provider retained, next-intl plugin kept composed, teardown and report in agreement. Previously the provider was swapped and the plugin dropped while the package stayed, and the report claimed a provider that no longer rendered.
- An i18next plural whose key shares a prefix with a context base (`friend_request_one` beside `friend_male`) now converts to an ICU plural when a call site passes `{ count }` for it, instead of being skipped as a combined context+plural under the wrong key name.
- The react-i18next three-argument form `t(key, 'default', { count })` keeps its options object: the call-site codemod drops only the positional default, and the evidence scanner reads the options argument, so plurals and context selectors written that way group and render correctly.
- Call-site evidence honors a custom `keySeparator`: nested keys recorded as `profile|friend` normalize to the converter's dotted paths, so their context selectors and plurals convert instead of silently staying literal.
- A client-component layout that keeps its provider in a partial migration names the adapter's own provider in the report TODO (react-intl layouts previously got no note because the check was hardcoded to `NextIntlClientProvider`).
- When no package manager can be detected in a non-interactive run (no lockfile), `gt migrate` no longer dies on the selection prompt after writing its edits: the run completes, the report is written, and it carries the manual gt-next install step.
- The react-intl codemod cleans up after itself under strict linting: a local binding stranded by the `createIntl` to `getTranslations()` swap, the `params` parameter a fully-orphaned route-param destructure leaves behind, and provider-wrapper props orphaned by the `IntlProvider` unwrap are all removed when nothing else references them (rest-element and type-annotation safety rules apply; still-referenced bindings always survive).
- A partial-migration report names the retained provider only when the migration actually left one rendering; a project with a bespoke server-side setup and no provider gets the plain retained-package sentence instead of a claim about a provider it never had.
- The report reaches the console before the report file is written, and a failed report-file write (disk full after the migration writes, a permission error on the project root) warns instead of throwing, so the migration summary is never lost right after a successful run.
- A dynamic `useTranslation(nsVar)` namespace (anything but a string literal) skips the file with a report entry instead of being silently treated as the default namespace, which compiled cleanly and then resolved every key against the wrong dictionary scope at runtime.
- A `t()` key fallback array containing a dynamic element (`t(['key', someVar])`) skips the file with a report entry; the winning key cannot be resolved at build time and gt-next's `t()` takes a single string key, so the previous silent pass-through emitted code that broke at the call site.
- Every supported source is now gated on the App Router: `gt migrate --from next-intl` or `--from react-intl` against a Pages Router project (no `app/` or `src/app/`) refuses with the same scoped diagnostic react-i18next already had, instead of scaffolding gt-next into an app that cannot use it.
- The on-demand engine cache marks completed installs and self-heals: an interrupted first fetch no longer leaves a partial tree that every later run trusts and fails on; a cache that resolves but cannot be imported is wiped and reinstalled once, and the failure diagnostic names the cache directory.
- The react-intl default-catalog harvest resolves aliased imports the same way the transform does: `import { FormattedMessage as FM }` and an aliased `defineMessages` now contribute their `defaultMessage`s to a synthesized catalog, instead of the component being rewritten with no catalog entry behind it.
- File discovery sorts its glob results, so processing order and the report's file lists are deterministic; previously two identical projects could list their converted files in a different order because the filesystem enumerates directory entries differently across copies.
