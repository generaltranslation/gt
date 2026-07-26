import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import {
  getAdapter,
  supportedSourceIds,
  type SourceAdapter,
} from '../adapters/index.js';
import {
  checkExistingGtConfig,
  emitGtFiles,
  findLocaleLayout,
  supportsRootParams,
} from '../emit/emitGtFiles.js';
import { matchFiles } from '../fs/matchFiles.js';
import { moduleSpecifierMatches } from '../fs/moduleSpecifiers.js';
import type { MigrateIO } from './io.js';
import { resolveCatalogsInteractively } from '../catalogs/promptFallbacks.js';
import { hasDependency, resolveMigrationSource } from './resolveSource.js';
import {
  detectLatentClientCallHazards,
  isTestFilePath,
  loadImportAliases,
  resolveImportToProjectFiles,
} from './latentClientCalls.js';
import { auditConvertedDictionaryKeys } from './auditDictionaryKeys.js';
import { createMigrateDiagnostic } from './diagnostics.js';
import { transformLayoutFile } from '../transforms/transformLayout.js';
import { transformSourceFile } from '../transforms/transformSource.js';
import type {
  MigrateOptions,
  MigrationContext,
  SourceResult,
} from './types.js';

/**
 * The default source-file globs the scan covers. Mirrors the CLI's
 * DEFAULT_SRC_PATTERNS; kept as a local constant so the engine carries no
 * dependency on CLI config modules.
 */
const DEFAULT_SRC_PATTERNS = [
  'src/**/*.{js,jsx,ts,tsx}',
  'app/**/*.{js,jsx,ts,tsx}',
  'pages/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
];

/**
 * The interface contract between the gt CLI and this engine. The CLI checks
 * this value after loading the engine and refuses to run on a mismatch (naming
 * both versions and telling the user to update gt), so a CLI paired with an
 * incompatible engine build fails loudly instead of miscompiling. Bump it only
 * on a breaking change to `runMigration`'s signature, the `MigrateIO` shape, or
 * the returned `MigrationContext`.
 */
export const MIGRATE_INTERFACE_VERSION = 1;

/**
 * `gt migrate`: converts an existing i18n setup in a Next.js App Router
 * project to gt-next. Sources are handled by pluggable adapters selected with
 * the required `--from` flag (next-intl, react-intl, react-i18next today; the
 * registry lives in ../adapters/). This doc describes the core
 * next-intl engine; each adapter's module documents its own mapping and
 * limits.
 *
 * Strategy: dictionary-compat by default. gt-next's `useTranslations` and
 * `getTranslations` share next-intl's names, namespace resolution, and ICU
 * interpolation, so most call sites survive an import swap. Existing
 * per-locale catalogs keep working through a generated `loadDictionary.ts`
 * (no re-translation). The command never embeds source text: transforms
 * that would orphan existing translations (`t.rich` to `<T>`, static
 * `t('key')` inlining) are out of scope and skip with a report entry; an
 * opt-in inline-conversion pass is planned as a follow-up PR.
 *
 * Files using APIs with no gt-next equivalent (`useFormatter`, `t.raw`,
 * ...) are skipped whole. While any exist, next-intl stays installed,
 * `createNextIntlPlugin` stays composed around `withGTConfig`, the request
 * config's `requestLocale` fallback is rewired through gt-next's
 * `getLocale()` so skipped files (client and server) resolve the page
 * locale instead of the default, and `NextIntlClientProvider` renders
 * nested inside `GTProvider` with an explicit `locale`. The report
 * (`gt-migrate-report.md`) lists every skip and TODO; nothing is dropped
 * silently.
 *
 * Scope is decoupled from safety: the scan covers `src/`, `app/`, `pages/`,
 * `components/`, plus `i18n/**` and wherever the routing/request config
 * lives, but
 * teardown decisions consult every source file in the project. Anything
 * outside the scan (an explicit `--src`, an unconventional directory) that
 * still imports next-intl counts as a skip and blocks the teardown. On a
 * full migration the routing/request config files are deleted only when
 * nothing still imports them (`routing.locales` in generateStaticParams is
 * inlined first); gt-next is installed with the project's package manager
 * when missing.
 *
 * Navigation wrappers: `Link` re-exports from `gt-next/link`; `usePathname`
 * becomes a locale-prefix-stripping wrapper (next-intl's returns the
 * pathname without the prefix); `redirect`/`useRouter` pass through
 * `next/navigation` with a TODO. Routing configs with localized `pathnames`
 * skip the navigation file whole, since gt-next does not localize path
 * segments.
 *
 * Pipeline ordering below is load-bearing in one place: `transformLayout`
 * runs after the source pass and layouts are classified to a fixed point
 * before any is applied (a layout's own skip flips provider retention for
 * its siblings), all before the config lane and `emitGtFiles` (it inlines
 * `routing.locales` before the routing file can be deleted). All transforms are babel
 * parse/traverse/generate (`retainLines`) like the existing wizard
 * codemods; `--dry-run` prints the report without writing.
 *
 * react-intl and react-i18next run through their adapters' own transform
 * sets behind the same required `--from` flag; next-i18next, bare i18next,
 * and Pages Router setups route out with a scoped message in
 * `resolveMigrationSource`.
 *
 * Known upstream constraints (verified against a real app, 2026-07):
 * - native-ESM configs (`next.config.mjs`, or `.js` with `"type":
 *   "module"`) break at build time because gt-next/config's ESM bundle
 *   calls bare `require`. The command emits a TODO advising a rename to
 *   `next.config.ts`.
 * - runtime `loadDictionary` resolution in webpack builds needs the
 *   gt-next fix from #1909 (shipped in gt-next 11.1.0); with it, both migration modes build and serve
 *   cleanly.
 *
 * This is the engine entry point the gt CLI loads on demand. It is UI-free:
 * everything interactive or process-level goes through `io`, and it never
 * touches disk. It returns the fully populated `MigrationContext` (the buffered
 * edits, todos, warnings, skips, and stats); the caller prints/writes the
 * report and applies the edits.
 */
export async function runMigration(
  options: MigrateOptions,
  library: string,
  io: MigrateIO,
  cwd: string = process.cwd()
): Promise<MigrationContext> {
  // Resolve the source-library adapter from --from (required by the CLI). An
  // unknown/unsupported source is a clean error listing what is supported (the
  // list grows as adapters are added to the registry). determineLibrary
  // collapses react-i18next / next-i18next / bare i18next all to 'i18next';
  // resolveMigrationSource resolves the concrete flavor (or the scoped OUT
  // message) before the registry lookup, so a concrete --from
  // (e.g. react-i18next) passes straight through.
  const resolution = resolveMigrationSource(options.from, cwd);
  if (resolution.kind === 'error') {
    io.fatal(resolution.message);
  }
  const adapter = getAdapter(resolution.id);
  if (!adapter) {
    io.fatal(
      createMigrateDiagnostic({
        severity: 'Error',
        whatHappened: `gt migrate cannot migrate from '${resolution.id}'`,
        fix: `Pass one of the supported sources: ${supportedSourceIds().join(', ')}.`,
      })
    );
  }

  // --from is user input, not detection, so confirm the requested library is
  // actually reachable from cwd (declared here or hoisted into a shared
  // node_modules); otherwise the run would "succeed" (write scaffolding) while
  // leaving every source file untouched, since no import matches.
  if (!isSourceLibraryInstalled(cwd, adapter)) {
    io.fatal(
      createMigrateDiagnostic({
        severity: 'Error',
        whatHappened: `--from ${options.from} was passed, but ${adapter.displayName} was not found in this project`,
        why: 'it is not declared in package.json and is not present in node_modules',
        fix: 'Install it first, or correct the --from value, then re-run.',
      })
    );
  }

  // Detection is advisory now that --from is explicit, but a mismatch is worth
  // a note (the wrong --from on a mixed project would otherwise run to
  // "nothing to migrate" with no hint).
  if (
    library !== 'base' &&
    library !== adapter.id &&
    !(library === 'i18next' && adapter.id === 'react-i18next')
  ) {
    io.warn(
      createMigrateDiagnostic({
        severity: 'Warning',
        whatHappened: `Detected '${library}' in this project, but migrating from ${adapter.displayName} per --from`,
        fix: 'If you targeted the wrong source, re-run with the correct --from value.',
      })
    );
  }

  // If next-intl is the target but react-i18next is also installed, the user
  // may have meant the other surface; point them at the flag so a project does
  // not get silently half-migrated (the m2 finding).
  if (adapter.id === 'next-intl' && hasDependency(cwd, 'react-i18next')) {
    io.warn(
      createMigrateDiagnostic({
        severity: 'Warning',
        whatHappened:
          'Also detected react-i18next in your dependencies; this run migrates next-intl only',
        fix: 'Re-run with --from react-i18next to target the react-i18next surface instead.',
      })
    );
  }

  io.guardGit(cwd, options);

  if (!options.yes && !options.dryRun) {
    const proceed = await io.promptConfirm({
      message:
        'This will rewrite source files in place (your translations are preserved). ' +
        'Make sure changes are committed or stashed. Continue?',
      defaultValue: true,
    });
    if (!proceed) io.fatal('Migration cancelled.');
  }

  const routing = adapter.parseRoutingConfig(cwd);
  let catalogs: Awaited<ReturnType<typeof adapter.discoverCatalogs>>;
  try {
    catalogs = await adapter.discoverCatalogs(cwd, routing, io);
    if (!catalogs && adapter.id === 'next-intl') {
      // Detection came up empty, or found catalogs but not one per configured
      // locale (discover warns with the specifics first): ask the user
      // directly (same building blocks as `gt setup`) instead of guessing.
      // Returns null when the session is non-interactive, which falls through
      // to the hard error below. Gated to next-intl: the other adapters'
      // discovery does re-nesting/ICU conversion that a raw directory prompt
      // would bypass, so their misses stay hard errors until each grows its
      // own prompt path.
      catalogs = await resolveCatalogsInteractively(cwd, routing, io);
    }
  } catch (error) {
    // e.g. a malformed locale JSON; nothing has been written yet.
    io.fatal(error instanceof Error ? error.message : String(error));
  }
  if (!catalogs) {
    io.fatal(
      createMigrateDiagnostic({
        severity: 'Error',
        whatHappened: `Could not locate ${adapter.displayName} message catalogs`,
        why: "the request config's import path, messages/, src/messages/, and locales/ were all checked and none held a JSON catalog per locale",
        fix: 'Pass --src or add a JSON catalog per locale and retry.',
      })
    );
  }
  // The routed locale set and the migrated locale set must agree: routing
  // feeds generateStaticParams and the navigation wrapper, catalogs feeds
  // gt.config.json and loadDictionary, and a locale present in one but not
  // the other prerenders pages whose first t() throws over a dictionary that
  // cannot serve them. Discovery enforces this (it bails on a routed locale
  // with no catalog and drops catalog files routing does not list), but the
  // interactive fallback re-enters with whatever list the user accepted, so
  // the invariant is re-established here, the one point every catalog source
  // funnels through (round-10 A1).
  if (routing.locales) {
    const catalogSet = new Set(catalogs.locales);
    const routedSet = new Set(routing.locales);
    const unservable = routing.locales.filter(
      (locale) => !catalogSet.has(locale)
    );
    const unroutable = catalogs.locales.filter(
      (locale) => !routedSet.has(locale)
    );
    if (unservable.length > 0 || unroutable.length > 0) {
      const kept = routing.locales.filter((locale) => catalogSet.has(locale));
      if (kept.length === 0 || !kept.includes(catalogs.defaultLocale)) {
        io.fatal(
          createMigrateDiagnostic({
            severity: 'Error',
            whatHappened:
              'The routing config and the catalogs to migrate share no usable locale set',
            details:
              `the routing config lists [${routing.locales.join(', ')}], ` +
              `the catalogs cover [${catalogs.locales.join(', ')}] with ` +
              `default '${catalogs.defaultLocale}', and the migrated set ` +
              'must contain its own default locale',
            fix: 'Add the missing catalog files, or update the routing config, and re-run. Nothing has been written.',
          })
        );
      }
      routing.locales = kept;
      catalogs.locales = kept;
      const dropped: string[] = [];
      if (unservable.length > 0) {
        dropped.push(
          `the routing config lists [${unservable.join(', ')}] with no ` +
            'catalog file to serve, so those locales are not migrated: they ' +
            'are left out of generateStaticParams and gt.config.json, and ' +
            'their URLs stop resolving as locales. Add the missing catalog ' +
            'files and re-run to keep them'
        );
      }
      if (unroutable.length > 0) {
        dropped.push(
          `catalog files exist for [${unroutable.join(', ')}] that the ` +
            'routing config does not route; they stay on disk but are not ' +
            'served'
        );
      }
      (catalogs.warnings ??= []).push(
        `Locale set narrowed to [${kept.join(', ')}]: ${dropped.join('; ')}.`
      );
    }
    if (
      routing.defaultLocale !== null &&
      routing.defaultLocale !== catalogs.defaultLocale
    ) {
      (catalogs.warnings ??= []).push(
        `The routing config's default locale ('${routing.defaultLocale}') ` +
          `differs from the migrated default ('${catalogs.defaultLocale}'); ` +
          `the migration uses '${catalogs.defaultLocale}' everywhere a ` +
          'default is emitted.'
      );
      routing.defaultLocale = catalogs.defaultLocale;
    }
  }

  // `catalogs.dir` is the directory the MIGRATION uses (where loadDictionary is
  // pointed, and where an adapter that rewrites catalog formats writes them), not
  // necessarily the directory discovery read from: the react-intl adapter
  // repoints it at a sibling gt-owned dir when it re-nests or synthesizes, and
  // the react-i18next adapter sets it to a brand-new output dir while the source
  // catalogs live under locales/<locale>/. Printing it as "found in" therefore
  // named a path that does not exist on disk yet (the round-9 parity finding), so
  // the line labels the directory by the role it actually has.
  // Both halves are printed: WHERE the catalogs were found (the react-i18next
  // user whose files live under locales/<locale>/ could not otherwise tell that
  // those were the ones read) and WHERE this migration will serve them from
  // (round-9 R1 #4 and its re-attack residual).
  const asDir = (dir: string) => `${path.relative(cwd, dir) || '.'}/`;
  io.info(
    `Found catalogs for [${catalogs.locales.join(', ')}] in ` +
      `${asDir(catalogs.sourceDir ?? catalogs.dir)} ` +
      `(default: ${catalogs.defaultLocale}); catalog directory for the ` +
      `migration: ${asDir(catalogs.dir)}`
  );

  const ctx: MigrationContext = {
    cwd,
    catalogs,
    routing,
    adapter,
    edits: [],
    todos: [],
    warnings: [],
    skippedFiles: new Map(),
    stats: {},
    // -c/--config; commander's default resolves an existing root
    // gt.config.json or '' when none exists yet.
    configFile: options.config
      ? path.resolve(cwd, options.config)
      : path.join(cwd, 'gt.config.json'),
  };
  // Advisory notes and report TODOs the adapter raised during catalog discovery
  // (an assumed default locale, a synthesized/augmented source catalog,
  // conflicting defaultMessage variants) are surfaced through the report.
  if (catalogs.warnings) ctx.warnings!.push(...catalogs.warnings);
  if (catalogs.reportTodos) ctx.todos.push(...catalogs.reportTodos);

  // Files owned by the config lane (pass 3 / emitGtFiles) must not go
  // through the generic source pass; they'd register as skips. The candidate
  // filenames come from the adapter, so a source with no Next.js config lane
  // contributes none.
  const configLaneFiles = new Set(
    [
      routing.routingFile,
      routing.requestFile,
      ...findRootFiles(cwd, [
        ...adapter.nextConfigCandidates,
        ...adapter.middlewareCandidates,
      ]),
    ].filter((file): file is string => file !== null)
  );

  // Pass 1: regular source files (layouts and NextIntlClientProvider-bearing
  // files deferred; they need the final skip set to decide provider retention).
  // Default scope covers the conventional i18n config directory too; the
  // shared defaults miss a root-level i18n/ (navigation.ts lives there), and
  // wherever the routing/request files actually sit.
  const defaultPatterns = [
    ...DEFAULT_SRC_PATTERNS,
    'i18n/**/*.{js,jsx,ts,tsx}',
  ];
  for (const configFile of [routing.routingFile, routing.requestFile]) {
    if (!configFile) continue;
    const dir = path
      .relative(cwd, path.dirname(configFile))
      .split(path.sep)
      .join('/');
    if (dir && !dir.startsWith('..')) {
      defaultPatterns.push(`${dir}/**/*.{js,jsx,ts,tsx}`);
    }
  }
  const sourceFiles = [
    ...new Set(matchFiles(cwd, options.src ?? defaultPatterns)),
  ];
  ctx.sourceFiles = sourceFiles;
  // The whole project, independent of scope; teardown and still-imported
  // checks must never be blind to files the scan skipped.
  const projectFiles = matchFiles(cwd, [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/out/**',
    '!**/coverage/**',
  ]);
  ctx.projectFiles = projectFiles;
  const layouts: string[] = [];
  // Non-layout files that render a NextIntlClientProvider. Like layouts, their
  // provider-retention decision hinges on the final skip set (a partial
  // migration must keep the provider so skipped files still have a next-intl
  // context), so they are deferred until every other file's skip status is
  // known; see the deferred passes below.
  const providerFiles: string[] = [];
  const navigationFiles: { file: string; code: string }[] = [];
  for (const file of sourceFiles) {
    if (configLaneFiles.has(file)) continue;
    try {
      const code = fs.readFileSync(file, 'utf8');
      // Locale-aware navigation callers (router.replace(href, { locale }),
      // redirect({ href, locale })) skip whole and hold the wrapper. Scanned
      // before every other classification because such a caller may have no
      // direct source-library import at all (it imports only the wrapper), so
      // no other pass would ever see it.
      const navCallerReason =
        adapter.navigation?.detectLocaleAwareCaller?.(code);
      if (navCallerReason) {
        ctx.skippedFiles.set(file, [navCallerReason]);
        (ctx.localeAwareNavCallers ??= []).push(file);
        continue;
      }
      // Test files are not runtime code: no codemod can follow a vi.mock()/
      // jest.mock() of the source module or an IntlProvider render helper,
      // and converting the components they render breaks the suites either
      // way. They form an explicit manual stage: excluded from conversion,
      // listed in the report's own test section, and held as skips (provider
      // and teardown survive for them) when, and only when, they really
      // import the library; see recordTestFileNeedingMigration.
      if (isTestFilePath(file, cwd) || mocksSourceLibrary(code, adapter)) {
        recordTestFileNeedingMigration(ctx, adapter, file, code);
        continue;
      }
      if (isLayoutFile(file)) {
        layouts.push(file);
        continue;
      }
      if (adapter.navigation?.isNavigationFile(code)) {
        // Deferred below (Pass 1b): the wrapper's convert-vs-hold decision
        // needs the complete locale-aware-caller set, which exists only once
        // this loop and the outside-scan check have both finished.
        navigationFiles.push({ file, code });
        continue;
      }
      if (adapter.hasProvider(code)) {
        providerFiles.push(file);
        continue;
      }
      collect(ctx, file, runSourceTransform(file, code, ctx), code);
    } catch (error) {
      recordTransformError(ctx, file, error);
    }
  }

  // Pre-flight for adapters whose consumers only work behind a real server
  // provider boundary (react-intl, react-i18next). gt-next's GTProvider is an
  // async Server Component with children-only props, so it needs a Server
  // Component layout to mount in, and the locale must resolve per-route
  // through next/root-params ([locale] as the ROOT layout). When either
  // condition fails there is no mechanical wiring that yields a correct app:
  // conversion produces output that builds and then breaks at runtime (a
  // production dictionary crash from GTProvider inside a client layout;
  // default-language content on every non-default locale route — the round-7
  // AutoHack/Memo/Sniply failures). Stop with the manual steps instead; edits
  // are buffered, so nothing has been written.
  if (adapter.requiresServerProviderBoundary) {
    const boundaryProblem = checkServerProviderBoundary(ctx);
    if (boundaryProblem) {
      io.fatal(
        createMigrateDiagnostic({
          severity: 'Error',
          whatHappened:
            "gt migrate cannot wire gt-next's provider and locale correctly in this project",
          why: boundaryProblem.why,
          reassurance: 'Nothing has been written.',
          fix: boundaryProblem.fix,
        })
      );
    }
  }

  // Files outside the scan (an explicit --src scope, or globs that missed a
  // directory) that still use next-intl count as skips: the provider, the
  // plugin, and the package must all survive for them. Without this, a
  // scoped run tears next-intl down while unscanned files still import it.
  const scanned = new Set([...sourceFiles, ...configLaneFiles]);
  for (const file of projectFiles) {
    if (scanned.has(file)) continue;
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const isTestFile =
      isTestFilePath(file, cwd) || mocksSourceLibrary(content, adapter);
    if (adapter.projectUsagePattern.test(content)) {
      // Same test-stage routing as Pass 1: a tests/ tree at the project root
      // sits outside the default globs, and its setup/helpers are the most
      // common holders of the provider wiring the suites depend on.
      if (isTestFile) {
        recordTestFileNeedingMigration(ctx, adapter, file, content);
      } else {
        ctx.skippedFiles.set(file, [
          `uses ${adapter.displayName} but was not scanned (outside the --src scope or the default globs); include it or convert it manually`,
        ]);
      }
      continue;
    }
    // Same locale-aware-navigation check as Pass 1: an unscanned caller that
    // imports only the wrapper matches no source-library pattern, yet its
    // call sites break just as hard once the wrapper is converted.
    const navCallerReason =
      adapter.navigation?.detectLocaleAwareCaller?.(content);
    if (navCallerReason) {
      ctx.skippedFiles.set(file, [navCallerReason]);
      (ctx.localeAwareNavCallers ??= []).push(file);
      continue;
    }
    // The import-shaped projectUsagePattern above cannot see the bare
    // specifier in vi.mock('next-intl', ...) / jest.mock(...): there is no
    // from/import/require prefix to match. That string is the entire i18n
    // wiring of many suites (a project-root tests/setup.ts is the common
    // shape), and Pass 1 never sees such a file because the tests tree sits
    // outside the default globs, so the suites broke with the report saying
    // nothing at all (the round-9 Sniply finding: 24 failing tests, zero
    // mentions of "test" in the report). Checked last, so the import and
    // locale-aware-navigation paths above keep their exact precedence.
    if (isTestFile) {
      recordTestFileNeedingMigration(ctx, adapter, file, content);
    }
  }

  // The failing suite is often not the file that names the source library: a
  // spec that renders through a flagged helper (tests/i18n-test-utils.tsx)
  // has no reference of its own, so neither pass above can see it. Close over
  // test-file imports so the report names the suites that break, not only the
  // helper they share.
  addTransitiveTestFiles(ctx, projectFiles);

  // Pass 1b: navigation wrappers, deferred from Pass 1 so the
  // locale-aware-caller set (Pass 1 + the outside-scan check above) is
  // complete before the wrapper decides between converting and holding.
  for (const { file, code } of navigationFiles) {
    try {
      const navigation = adapter.navigation!.transformNavigation(
        file,
        code,
        ctx
      );
      if (navigation.code !== null || navigation.skipReasons.length > 0) {
        collect(ctx, file, navigation, code);
        continue;
      }
      // The transform claimed nothing: the detection was a false match (a
      // comment, an unrelated helper with the same name). Fall through to
      // the generic source pass so real source-library usage in this file
      // is still converted or registered as a skip.
      if (adapter.hasProvider(code)) {
        providerFiles.push(file);
        continue;
      }
      collect(ctx, file, runSourceTransform(file, code, ctx), code);
    } catch (error) {
      recordTransformError(ctx, file, error);
    }
  }

  // Latent client-call hazards (a server module calling a function imported
  // from a 'use client' module) decide whether the emit phase may restore
  // static rendering: prerendering such a route executes the call and fails
  // the build, so while any exist the resolvers are withheld and routes stay
  // dynamic, exactly as the baseline rendered them. Detected here, on
  // baseline content, before any conversion decisions read it.
  detectLatentClientCallHazards(ctx);

  // Pass 2a: classify deferred provider files. A provider file that must be
  // skipped for its own reasons (an unsupported next-intl API alongside the
  // provider) contributes to the skip set, which in turn flips the retention
  // decision for the *other* deferred files and the layouts. Skip status is
  // independent of retainProvider (the transform is pure), so we can
  // settle every skip here, before anyone reads ctx.skippedFiles.size.
  const providerFilesToApply: string[] = [];
  for (const file of providerFiles) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const classified = runSourceTransform(file, code, ctx);
      if (classified.skipReasons.length > 0) {
        collect(ctx, file, classified, code);
      } else {
        providerFilesToApply.push(file);
      }
    } catch (error) {
      recordTransformError(ctx, file, error);
    }
  }

  // Pass 2b-pre: the config lane can skip too (middleware with extra logic,
  // localePrefix shapes, unresolved routing values, unrecognized plugin
  // shapes), and those skips must be in the set before retention is decided.
  // Otherwise the run splits its brain: providers and layouts get
  // full-migration treatment and the source library's plugin is torn down,
  // while the skipped middleware holds the package itself back, and the
  // report then claims a provider that no longer renders. Classification
  // only: the transforms are pure (same contract as the passes above), so
  // edits and todos from these calls are discarded here and regenerated by
  // the Pass 3 apply against the settled skip set.
  for (const [candidates, transform] of [
    [adapter.nextConfigCandidates, adapter.transformNextConfig],
    [adapter.middlewareCandidates, adapter.transformMiddleware],
  ] as const) {
    if (!transform) continue;
    for (const configFile of findRootFiles(cwd, candidates)) {
      try {
        const code = fs.readFileSync(configFile, 'utf8');
        const classified = transform(configFile, code, ctx);
        if (classified.skipReasons.length > 0) {
          ctx.skippedFiles.set(configFile, classified.skipReasons);
        }
      } catch (error) {
        recordTransformError(ctx, configFile, error);
      }
    }
  }

  // Pass 2b: layouts. A layout's own skip flips provider retention for every
  // other layout (the layout transform reads ctx.skippedFiles live), and a
  // flip to retention can itself skip another layout (the unsafe-async
  // fallback only exists while a provider is retained), so classify all
  // layouts to a fixed point before applying any of them. Otherwise a root
  // layout processed first drops the retained client provider that a
  // later-skipped nested layout still needs. Skips only accumulate (retention
  // never flips back off), so each round either adds a skip or ends the loop.
  const layoutSources = new Map(
    layouts.map((file) => [file, fs.readFileSync(file, 'utf8')] as const)
  );
  for (;;) {
    let newSkips = false;
    for (const [file, code] of layoutSources) {
      if (ctx.skippedFiles.has(file)) continue;
      const classified = runLayoutTransform(adapter, file, code, ctx);
      if (classified.skipReasons.length > 0) {
        ctx.skippedFiles.set(file, classified.skipReasons);
        newSkips = true;
      }
    }
    if (!newSkips) break;
  }
  // Apply with the final skip set. The last classification round ran against
  // this exact state and found no new skips, so these results are settled.
  for (const [file, code] of layoutSources) {
    if (ctx.skippedFiles.has(file)) continue;
    collect(ctx, file, runLayoutTransform(adapter, file, code, ctx), code);
  }

  // Pass 2c: apply the deferred provider files now that the skip set is final
  // (layouts can add skips too). Retention matches the layout decision, so a
  // partial migration keeps NextIntlClientProvider (and its messages wiring)
  // for the skipped files, while a clean full migration swaps it for
  // <GTProvider> exactly as a single-pass run would.
  const retainProviders = ctx.skippedFiles.size > 0;
  for (const file of providerFilesToApply) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      collect(
        ctx,
        file,
        runSourceTransform(file, code, ctx, retainProviders),
        code
      );
    } catch (error) {
      recordTransformError(ctx, file, error);
    }
  }

  // Pass 3: root config files. Each config-lane transform is an optional
  // adapter method; a source with no Next.js config lane supplies none, so the
  // corresponding loop is skipped entirely.
  const transformNextConfig = adapter.transformNextConfig;
  if (transformNextConfig) {
    for (const configFile of findRootFiles(cwd, adapter.nextConfigCandidates)) {
      try {
        const code = fs.readFileSync(configFile, 'utf8');
        collect(
          ctx,
          configFile,
          transformNextConfig(configFile, code, ctx),
          code
        );
        if (isEsmNextConfig(configFile, cwd)) {
          // gt-next/config's ESM bundle currently breaks under a native-ESM
          // config ("require is not defined" resolving the Next.js version).
          ctx.todos.push({
            file: configFile,
            reason:
              'this config loads as native ESM, where gt-next/config (<= 11.0.9) fails with "require is not defined"; rename it to next.config.ts (Next.js compiles it to CJS) until gt-next ships an ESM-safe config entry',
          });
        }
      } catch (error) {
        recordTransformError(ctx, configFile, error);
      }
    }
  }
  const transformMiddleware = adapter.transformMiddleware;
  if (transformMiddleware) {
    for (const middlewareFile of findRootFiles(
      cwd,
      adapter.middlewareCandidates
    )) {
      try {
        const code = fs.readFileSync(middlewareFile, 'utf8');
        collect(
          ctx,
          middlewareFile,
          transformMiddleware(middlewareFile, code, ctx)
        );
      } catch (error) {
        recordTransformError(ctx, middlewareFile, error);
      }
    }
  }

  // Partial migrations keep the source library's request config alive for
  // skipped files, but gt-next's middleware no longer feeds it a locale;
  // rewire its fallback to getLocale() so skipped files render the page locale
  // instead of the default one.
  const transformRequestConfig = adapter.transformRequestConfig;
  if (
    transformRequestConfig &&
    ctx.skippedFiles.size > 0 &&
    routing.requestFile &&
    fs.existsSync(routing.requestFile)
  ) {
    try {
      const code = fs.readFileSync(routing.requestFile, 'utf8');
      collect(
        ctx,
        routing.requestFile,
        transformRequestConfig(routing.requestFile, code)
      );
    } catch (error) {
      recordTransformError(ctx, routing.requestFile, error);
    }
  }

  // Next.js ignores root-level middleware when the app lives in src/;
  // locale routing would silently not run (true for next-intl too, but
  // worth surfacing while we're here).
  const rootMiddleware = findRootFiles(cwd, ['middleware.ts', 'middleware.js']);
  if (
    rootMiddleware.length > 0 &&
    (fs.existsSync(path.join(cwd, 'src/app')) ||
      fs.existsSync(path.join(cwd, 'src/pages')))
  ) {
    ctx.todos.push({
      file: rootMiddleware[0],
      reason:
        'middleware file is at the project root but the app lives in src/; Next.js ignores it there; move it to src/ or locale routing will not run',
    });
  }

  // A [locale] layout without <body> raises a "GTProvider was not added"
  // TODO, but when a layout ABOVE it received the provider that claim reads
  // as false (the round-7 PlantPal report inaccuracy). Scoped to ancestry:
  // in a (rare) multi-root-layout app, a subtree whose own layout chain never
  // got the provider keeps its TODO (the re-attack P3).
  const gtProviderLayoutDirs = ctx.edits
    .filter(
      (edit) =>
        edit.kind === 'write' &&
        isLayoutFile(edit.path) &&
        (edit.content ?? '').includes('<GTProvider')
    )
    .map((edit) => path.dirname(edit.path));
  if (gtProviderLayoutDirs.length > 0) {
    ctx.todos = ctx.todos.filter((todo) => {
      if (!todo.reason.startsWith('GTProvider was not added automatically')) {
        return true;
      }
      const todoDir = path.dirname(todo.file);
      return !gtProviderLayoutDirs.some(
        (dir) => todoDir === dir || todoDir.startsWith(dir + path.sep)
      );
    });
  }

  // A dead global mock breaks suites that never import any flagged file:
  // vitest/jest wire setup files by CONFIG, not imports, so a suite that
  // renders converted components fails without a single reference the import
  // closure can see (the round-9 sniply shape: tests/setup.ts mocks
  // next-intl, and the three failing suites import only the components).
  // When any flagged test file is a mock-only mention, name every test file
  // that imports converted code which now calls gt-next.
  addSuitesExercisingConvertedCode(ctx, adapter, projectFiles);

  // Failing suites must not be discoverable only by running them: echo the
  // test stage at the end of the run, not just inside the report.
  if (
    ctx.testFilesNeedingMigration &&
    ctx.testFilesNeedingMigration.length > 0
  ) {
    // The count is of FILES needing a hand migration; the failure prediction is
    // scoped to the suites among them. Saying "N files ... those suites FAIL"
    // promises N failing suites, which overstates by every file the test runner
    // wires through config: a setup file is never collected as a suite, so it
    // cannot fail on its own (the round-9 audit measured 4 files -> 3 failing
    // suites). No file is dropped from the count; only the prediction is scoped.
    (ctx.warnings ??= []).push(
      `${ctx.testFilesNeedingMigration.length} test file(s) depend on ` +
        `${adapter.displayName} test wiring (setup, render helpers, mocks) or ` +
        'on another test file that does; migrate that wiring by hand. The ' +
        'suites among them that exercise converted code FAIL until you do, ' +
        'unless every part of the app a file touches was left untouched by this ' +
        'run; a setup file your test runner wires by config is not itself a ' +
        "collected suite, so its breakage shows up in the suites it wires (see the report's " +
        '"Tests need manual migration" section).'
    );
  }

  // Count real source transforms before emitGtFiles adds the gt-next
  // scaffolding (config, loaders, resolvers). ctx.edits holds only transform
  // writes at this point.
  const transformedSourceFiles = ctx.edits.filter(
    (edit) => edit.kind === 'write'
  ).length;

  // An existing gt.config.json the merge below cannot read must stop the run
  // here: emitGtFiles would otherwise build its write from `{}` and enqueue a
  // replacement that discards the user's projectId/files/publish settings.
  // Edits are still buffered, so stopping leaves the project untouched.
  const configReadProblem = checkExistingGtConfig(ctx);
  if (configReadProblem) io.fatal(configReadProblem);

  ctx.edits.push(...emitGtFiles(ctx));

  // Hard post-condition: converted files are gt-next consumers, and gt-next
  // has no dictionary or locale wiring without withGTConfig in next.config.
  // If the config lane failed to install it (an export shape even the
  // fallback wrap could not reach, or a config skipped for its own reasons),
  // writing the conversion anyway ships an app whose every locale route fails
  // at runtime while the report reads as a success (the round-7 Memo Engine
  // 500s). Edits are still buffered, so stopping here leaves the project
  // untouched.
  if (transformedSourceFiles > 0 && !isGtConfigWired(ctx)) {
    const existing = findRootFiles(cwd, adapter.nextConfigCandidates);
    const detail = existing
      .map((configFile) => {
        const reasons = ctx.skippedFiles.get(configFile);
        const relativePath = path.relative(cwd, configFile);
        return reasons
          ? `${relativePath}: ${reasons.join('; ')}`
          : relativePath;
      })
      .join(' | ');
    io.fatal(
      createMigrateDiagnostic({
        severity: 'Error',
        whatHappened: `gt migrate could not install withGTConfig in this project's Next.js config (${detail || 'no config file found'})`,
        why: 'converted files resolve their dictionary and locale through withGTConfig; without it every migrated route fails at runtime',
        reassurance: 'Nothing has been written.',
        fix: "Wrap the config's export in withGTConfig(yourConfig, { dictionary: '<path to your default-locale catalog>' }) from gt-next/config by hand, then re-run gt migrate.",
      })
    );
  }

  // Adapters that rewrite catalogs (react-i18next: i18next JSON -> merged ICU
  // dictionaries) emit the converted files into their new output dir and record
  // conversion notes as TODOs here, so the writes flow through the same
  // --dry-run-aware edit buffer as everything else.
  let catalogEditsEmitted = 0;
  if (adapter.emitCatalogs) {
    const catalogEdits = adapter.emitCatalogs(ctx);
    catalogEditsEmitted = catalogEdits.length;
    ctx.edits.push(...catalogEdits);
  }

  // Every converted call site now resolves its keys through gt-next, which
  // THROWS on a key the dictionary does not have where the source library
  // rendered the raw key and logged. Both halves of that check are in hand
  // here (the emitted call sites and the catalogs, including any this run
  // rewrote), so cross-check them and report each unresolvable static key.
  auditConvertedDictionaryKeys(ctx);

  // Backstop: if nothing matched the source library at all (no file transformed,
  // none skipped for using it, and no catalogs converted), the run migrated
  // nothing and only wrote scaffolding. That almost always means the wrong
  // source was targeted, so warn instead of exiting 0 as if it worked. Skip
  // reasons and converted catalogs both count as activity, so a wrapper-skipped
  // or catalog-only run does not trip this.
  if (
    transformedSourceFiles === 0 &&
    ctx.skippedFiles.size === 0 &&
    catalogEditsEmitted === 0
  ) {
    // Under --dry-run nothing is written yet (the write loop is on the CLI
    // side, past the caller's dry-run early return), so describe the
    // scaffolding as prospective.
    const scaffoldingClause = options.dryRun
      ? 'The gt-next scaffolding would still be written'
      : 'The gt-next scaffolding was still written';
    io.warn(
      createMigrateDiagnostic({
        severity: 'Warning',
        whatHappened: `Nothing to migrate: no files importing ${adapter.displayName} were found`,
        why: `${options.from} may not be this project's i18n library`,
        reassurance: `${scaffoldingClause}.`,
        fix: 'Re-run with --from <library> if you targeted the wrong source.',
      })
    );
  }

  return ctx;
}

/**
 * Runs the source-file codemod. This is a thin wrapper: it only maps the
 * driver's `retainProvider` flag into TransformOptions and calls
 * transformSourceFile. The one place that decides between an adapter's own
 * transform (react-i18next, react-intl) and the core next-intl engine is
 * transformSourceFile itself, so there is a single source-transform dispatch
 * site for a reviewer to read (see the comment there).
 */
function runSourceTransform(
  file: string,
  code: string,
  ctx: MigrationContext,
  retainProvider?: boolean
): SourceResult {
  return transformSourceFile(file, code, ctx, { retainProvider });
}

/** Runs the layout codemod, dispatching to the adapter's own when present. */
function runLayoutTransform(
  adapter: SourceAdapter,
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  return adapter.transformLayout
    ? adapter.transformLayout(file, code, ctx)
    : transformLayoutFile(file, code, ctx);
}

/**
 * Errno codes that mean "this file exists but this process cannot read it",
 * as opposed to a genuine transform bug. A file in that state may hold an import
 * of anything, so the teardown decision cannot be made while one exists (see
 * ctx.unreadableFiles). ENOENT is deliberately absent: a file that is not there
 * imports nothing.
 */
const UNREADABLE_ERRNO = new Set([
  'EACCES',
  'EPERM',
  'EISDIR',
  'EIO',
  'ELOOP',
  'EBUSY',
  'EMFILE',
  'ENFILE',
]);

/**
 * Records a whole-file skip for an uncaught transform error, so one file
 * blowing up (e.g. a babel throw during a rewrite) degrades to a reported skip
 * with the file left untouched, instead of aborting the entire command with a
 * raw stack trace. The skip surfaces in the report's manual-migration section.
 *
 * A read failure is additionally recorded as an unreadable file: the skip alone
 * only says the file was left untouched, while the emit phase needs to know that
 * this file's imports are unknown before it decides any deletion.
 */
function recordTransformError(
  ctx: MigrationContext,
  file: string,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && UNREADABLE_ERRNO.has(code)) {
    (ctx.unreadableFiles ??= []).push(file);
  }
  ctx.skippedFiles.set(file, [
    `internal transform error on ${path.relative(ctx.cwd, file)}: ${message}; file left untouched`,
  ]);
}

function collect(
  ctx: MigrationContext,
  file: string,
  result: SourceResult,
  originalCode?: string
): void {
  if (result.skipReasons.length > 0) {
    ctx.skippedFiles.set(file, result.skipReasons);
    return;
  }
  ctx.todos.push(...result.todos);
  // A byte-identical write is not a conversion: listing it as "Converted"
  // misreports the run (the round-7 i18n-provider false entry), so drop it.
  if (result.code !== null && result.code !== originalCode) {
    ctx.edits.push({ path: file, kind: 'write', content: result.code });
  }
}

/**
 * Routes a test file into the explicit manual-migration stage when it
 * references the source library at all: a real import, OR a bare specifier
 * string, which is the only trace a `vi.mock('next-intl', …)` /
 * `jest.mock(…)` leaves (adapter.mentionedIn matches it; the import-shaped
 * projectUsagePattern cannot). Shared by both scan passes so a project-root
 * tests/ tree is classified exactly like one inside src/.
 *
 * The two kinds of reference are NOT equivalent for teardown, so they are
 * recorded differently:
 *
 * - a real import needs the package retained (it resolves at test time), so
 *   the file is also a skip. `ctx.skippedFiles` is what holds the whole
 *   teardown back (provider retention here and in transformLayout, plus the
 *   fullyMigrated gate in emitGtFiles), which is correct for this case.
 * - a mock-only mention needs nothing retained: the mock is dead the moment
 *   the components under test are converted (it intercepts a module they no
 *   longer import). Letting a dead string keep the package installed, keep its
 *   plugin composed in next.config, and keep its client provider nested inside
 *   GTProvider would hold a whole app's teardown hostage to a test file with
 *   no runtime effect, so it is reported without being made a skip.
 *
 * Either way the file lands in the report's test section, which is the thing
 * the user acts on.
 */
/**
 * True when the file MOCKS the source library's module (`vi.mock('next-intl')`,
 * `jest.mock('react-intl', …)`, `jest.doMock`, `vi.unstable_mockModule`). That
 * call shape exists only in test wiring, and it is the whole i18n setup of many
 * suites, so a file holding one belongs in the test stage no matter what it is
 * named: the setup-file conventions are open-ended (src/setupTests.ts,
 * test/bootstrap.ts, config/vitest-env.ts), and a name the path pattern misses
 * was filed as inert "retained wiring" instead (the round-9 F7 finding).
 *
 * Classification only; teardown is unaffected. recordTestFileNeedingMigration
 * makes a file a SKIP only when it really imports the library, so a mock-only
 * mention still never holds the migration back.
 */
function mocksSourceLibrary(code: string, adapter: SourceAdapter): boolean {
  const mockCall =
    /\b(?:vi|jest)\s*\.\s*(?:mock|doMock|unstable_mockModule)\s*\(\s*(['"][^'"]+['"])/g;
  for (const match of code.matchAll(mockCall)) {
    if (adapter.mentionedIn(match[1])) return true;
  }
  return false;
}

function recordTestFileNeedingMigration(
  ctx: MigrationContext,
  adapter: SourceAdapter,
  file: string,
  code: string
): void {
  const importsSource = adapter.projectUsagePattern.test(code);
  if (!importsSource && !adapter.mentionedIn(code)) return;
  if (importsSource) {
    ctx.skippedFiles.set(file, [
      `test file uses ${adapter.displayName}; migrate the test setup, render helpers, and mocks by hand (see the report's "Tests need manual migration" section)`,
    ]);
  }
  (ctx.testFilesNeedingMigration ??= []).push(file);
}

/**
 * Extends the test stage over test-file imports: any test file that imports an
 * already-flagged test file joins the stage. The flagged file is usually a
 * shared render helper or setup module, and the suites that break are its
 * importers, which carry no source-library reference themselves, so no scan
 * pass can see them (the round-9 Memo Engine finding: the report named
 * tests/i18n-test-utils.tsx while the two suites that actually failed,
 * citation-overlay.test.tsx and coverage-gate.test.tsx, went unmentioned).
 * Run to a fixed point so a chain of helpers closes too.
 *
 * Report-only by construction: these files never mention the source library,
 * so nothing about them needs retaining and they are deliberately kept out of
 * ctx.skippedFiles (which gates teardown). Resolution reuses the pipeline's
 * alias-aware resolver, so '@/tests/i18n-test-utils' resolves like the
 * bundler resolves it.
 */
function addTransitiveTestFiles(
  ctx: MigrationContext,
  projectFiles: string[]
): void {
  const flagged = new Set(ctx.testFilesNeedingMigration ?? []);
  if (flagged.size === 0) return;
  const candidates = projectFiles.filter(
    (file) => !flagged.has(file) && isTestFilePath(file, ctx.cwd)
  );
  if (candidates.length === 0) return;
  const fileSet = new Set(projectFiles);
  const aliases = loadImportAliases(ctx.cwd);
  const importsOf = new Map<string, string[]>();
  for (const file of candidates) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const resolved: string[] = [];
    for (const specifier of importSpecifiers(content)) {
      resolved.push(
        ...resolveImportToProjectFiles(
          specifier,
          path.dirname(file),
          fileSet,
          projectFiles,
          aliases
        )
      );
    }
    if (resolved.length > 0) importsOf.set(file, resolved);
  }
  const added: string[] = [];
  for (;;) {
    let grew = false;
    for (const file of candidates) {
      if (flagged.has(file)) continue;
      if (!importsOf.get(file)?.some((target) => flagged.has(target))) continue;
      flagged.add(file);
      added.push(file);
      grew = true;
    }
    if (!grew) break;
  }
  if (added.length > 0) {
    (ctx.testFilesNeedingMigration ??= []).push(...added);
  }
}

/**
 * Names the suites a dead global mock will break. An import-flagged helper's
 * blast radius is its importers (the closure above); a MOCK-ONLY setup file's
 * blast radius is every suite whose rendered components the mock used to
 * intercept, and those suites carry no reference any scan or closure can see
 * (vitest/jest register setup files through config). Approximation, stated
 * plainly: a test file that imports converted code which now calls gt-next is
 * named; whether it fails depends on whether the tested path reaches a hook,
 * so the report's section wording carries the "unless" clause. Report-only:
 * never added to ctx.skippedFiles.
 */
function addSuitesExercisingConvertedCode(
  ctx: MigrationContext,
  adapter: SourceAdapter,
  projectFiles: string[]
): void {
  const flagged = new Set(ctx.testFilesNeedingMigration ?? []);
  if (flagged.size === 0) return;
  const hasMockOnly = [...flagged].some((file) => {
    try {
      const code = fs.readFileSync(file, 'utf8');
      return (
        !adapter.projectUsagePattern.test(code) && adapter.mentionedIn(code)
      );
    } catch {
      return false;
    }
  });
  if (!hasMockOnly) return;
  const isTest = (file: string) => isTestFilePath(file, ctx.cwd);
  const convertedGtCallers = new Set(
    ctx.edits
      .filter(
        (edit) =>
          edit.kind === 'write' &&
          /\.[cm]?[jt]sx?$/.test(edit.path) &&
          !isTest(edit.path) &&
          (edit.content ?? '').includes('gt-next')
      )
      .map((edit) => edit.path)
  );
  if (convertedGtCallers.size === 0) return;
  const fileSet = new Set(projectFiles);
  const aliases = loadImportAliases(ctx.cwd);
  for (const file of projectFiles) {
    if (flagged.has(file) || !isTest(file)) continue;
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const hit = importSpecifiers(content)
      .flatMap((specifier) =>
        resolveImportToProjectFiles(
          specifier,
          path.dirname(file),
          fileSet,
          projectFiles,
          aliases
        )
      )
      .find((target) => convertedGtCallers.has(target));
    if (!hit) continue;
    flagged.add(file);
    (ctx.testFilesNeedingMigration ??= []).push(file);
    (ctx.testFileEvidence ??= new Map()).set(
      file,
      `imports converted code (${path.relative(ctx.cwd, hit)}) that now calls ` +
        `gt-next; the ${adapter.displayName} test wiring named here no longer intercepts it`
    );
  }
}

/**
 * Every module specifier a file imports from, for import-graph questions that
 * only need the specifier (not bindings). Static imports and re-exports come
 * from the AST; a file this parser cannot read falls back to a textual scan so
 * an exotic test file still contributes edges instead of silently dropping out
 * of the graph.
 */
function importSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    specifiers.push(...moduleSpecifierMatches(code));
    return specifiers;
  }
  for (const statement of ast.program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type'
    ) {
      specifiers.push(statement.source.value);
    } else if (
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportAllDeclaration') &&
      statement.source
    ) {
      specifiers.push(statement.source.value);
    }
  }
  return specifiers;
}

/**
 * True when the adapter's source library is reachable from `cwd`: either
 * declared in cwd/package.json or physically installed in the node_modules
 * chain above cwd. --from restores the presence guarantee auto-detect gives,
 * but a hoisted monorepo leaf can use a library that is declared only in a
 * parent package.json and hoisted into a shared node_modules, so a
 * cwd/package.json-only check would wrongly reject it. The adapter id and its
 * teardown package keys (the npm names that define the library) are both
 * checked. A truly-absent library matches neither, so a typo'd --from still
 * exits 1.
 */
function isSourceLibraryInstalled(
  cwd: string,
  adapter: SourceAdapter
): boolean {
  const candidates = new Set([adapter.id, ...adapter.teardownPackages]);
  return (
    isDeclaredInPackageJson(cwd, candidates) ||
    resolvesFromNodeModules(cwd, candidates)
  );
}

/**
 * True when cwd/package.json declares any of `names` in a dependency section
 * (the same sections determineLibrary reads). Missing/unparseable => false.
 */
function isDeclaredInPackageJson(cwd: string, names: Set<string>): boolean {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return false;
  let pkg: Record<string, Record<string, string> | undefined>;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch {
    return false;
  }
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };
  return [...names].some((name) => name in deps);
}

/**
 * True when any of `names` is physically installed in the node_modules chain
 * reachable from `cwd` (cwd/node_modules, then each parent up to the filesystem
 * root); exactly the directories Node's resolver searches. A hoisted monorepo
 * leaf resolves a dependency declared only in a parent this way.
 *
 * A directory probe is used rather than require.resolve on purpose: modern ESM
 * packages (next-intl among them) restrict their exports map, so both
 * `require.resolve('<lib>')` and `require.resolve('<lib>/package.json')` throw
 * ERR_PACKAGE_PATH_NOT_EXPORTED for an installed package, which would
 * reintroduce the false-negative this check exists to prevent.
 */
function resolvesFromNodeModules(cwd: string, names: Set<string>): boolean {
  let dir = path.resolve(cwd);
  for (;;) {
    for (const name of names) {
      if (fs.existsSync(path.join(dir, 'node_modules', name, 'package.json'))) {
        return true;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/**
 * Validates the two conditions gt-next needs before react-intl/react-i18next
 * consumers can be converted (see requiresServerProviderBoundary on the
 * adapter): a Server Component layout rendering <body> for GTProvider to
 * mount in, and a [locale] segment as the ROOT layout on root-params-capable
 * Next so the locale resolves per-route. Returns the human-readable problem,
 * or null when the boundary is sound.
 */
export function checkServerProviderBoundary(
  ctx: MigrationContext
): { why: string; fix: string } | null {
  // Locale resolution first: it also anchors WHICH layout chain the <body>
  // verdict below may judge. Judging every project layout returned the
  // client-layout stop for a SIBLING app's layout (a monorepo neighbor that
  // has nothing to do with the routes being migrated) — the re-attack P2.
  const localeLayout = findLocaleLayout(ctx);
  if (localeLayout.kind === 'none') {
    return {
      why: `the app has no [locale] route segment. gt migrate only knows how to wire gt-next's server-side locale resolution (withGTConfig + next/root-params), which needs one; this app resolves its locale in ${ctx.adapter.displayName}'s client-side state, which gt migrate cannot wire automatically, so every converted call site would render the default locale no matter what the user selects`,
      fix: "Move localized routes under a [locale] segment (app/[locale]/...) and re-run gt migrate, or wire gt-next's client GTProvider (it takes an explicit locale) to your locale state by hand.",
    };
  }
  if (localeLayout.kind === 'other-segment') {
    return {
      why: `the localized route segment is ${localeLayout.segment}, not [locale]; next/root-params only exposes a locale() export for a segment named literally [locale], and gt migrate has no other per-route locale source it can wire automatically, so every non-default locale would render in the default language`,
      fix: `Rename the ${localeLayout.segment} directory to [locale] (updating the imports and links that point at it), then re-run gt migrate.`,
    };
  }

  // The <body> mount-point verdict, judged ONLY on the layout chain that
  // renders the migrated routes: the [locale] layout and its ancestors.
  // Project-wide judging returned a verdict about a sibling app's layout (the
  // re-attack P2); scan-scoped judging false-stopped --src runs whose root
  // layout sat outside the scope. The chain comes from projectFiles, so both
  // are safe. Nearest chain layout that renders a literal <body> decides.
  const localeDir = path.dirname(localeLayout.file);
  const chainLayouts = (ctx.projectFiles ?? ctx.sourceFiles ?? [])
    .filter(isLayoutFile)
    .filter((file) => {
      const dir = path.dirname(file);
      return dir === localeDir || localeDir.startsWith(dir + path.sep);
    })
    // nearest first (deepest directory wins)
    .sort((a, b) => b.length - a.length);
  let bodyLayout: string | null = null;
  for (const file of chainLayouts) {
    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      // Unreadable/unparseable layout: the layout pass reports it; not a
      // boundary verdict.
      continue;
    }
    if (!hasBodyJsxElement(ast)) continue;
    bodyLayout = file;
    const isClientLayout = ast.program.directives.some(
      (directive) => directive.value.value === 'use client'
    );
    if (isClientLayout) {
      return {
        why: `${path.relative(ctx.cwd, file)} renders <body> but is a Client Component ('use client'); gt-next's server GTProvider (the one gt migrate wires) is an async Server Component and cannot load its dictionary inside a client layout — the build passes and production throws (Dictionary entry ... cannot be found)`,
        fix: "Split the layout: keep <html>/<body> in a Server Component and move the client logic into a nested client component, then re-run gt migrate. (Alternatively, wire gt-next's client GTProvider, which takes an explicit locale and translations, by hand.)",
      };
    }
    break;
  }
  if (!bodyLayout) {
    return {
      why: 'no layout in the [locale] chain renders a literal <body> element, so gt migrate has no Server Component mount point for GTProvider (a <body> produced through a wrapper component is not recognized)',
      fix: 'Ensure the root layout renders <html>/<body> directly, then re-run gt migrate; if yours does so through a wrapper component, add GTProvider around the app children by hand instead.',
    };
  }

  if (localeLayout.hasRootLayoutAbove) {
    return {
      why: 'a separate root layout sits above the [locale] segment, so next/root-params does not expose locale there, and gt migrate has no other per-route locale source it can wire automatically in this app; every route would render the default language',
      fix: "Merge the root layout down into [locale]/layout.tsx so [locale] is the root layout, then re-run gt migrate (or wire gt-next's client GTProvider to your locale state by hand).",
    };
  }
  if (!supportsRootParams(ctx.cwd)) {
    return {
      why: "this project's Next resolves below 15.5 (or its version could not be determined), so next/root-params — the only per-route locale signal gt migrate can wire in this app — is unavailable",
      fix: 'Upgrade Next to >= 15.5, then re-run gt migrate.',
    };
  }
  return null;
}

/** True when the AST renders a literal `<body>` JSX element somewhere. */
function hasBodyJsxElement(ast: ReturnType<typeof parse>): boolean {
  let found = false;
  const stack: object[] = [ast.program as unknown as object];
  while (stack.length > 0 && !found) {
    const node = stack.pop() as Record<string, unknown> & { type?: string };
    if (
      node.type === 'JSXOpeningElement' &&
      (node.name as { type?: string; name?: string })?.type ===
        'JSXIdentifier' &&
      (node.name as { name?: string }).name === 'body'
    ) {
      found = true;
      break;
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            stack.push(item);
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        stack.push(value);
      }
    }
  }
  return found;
}

/**
 * True when the migration's final state has withGTConfig wired into a Next
 * config: a buffered edit whose content carries it (a converted or freshly
 * created config), or an existing config candidate that already contains it
 * on disk (an idempotent re-run). Edits win over disk content for the same
 * path, so a config rewritten this run is judged by what will be written.
 */
function isGtConfigWired(ctx: MigrationContext): boolean {
  const candidatePaths = new Set(
    ctx.adapter.nextConfigCandidates.map((candidate) =>
      path.join(ctx.cwd, candidate)
    )
  );
  const editedByPath = new Map(
    ctx.edits
      .filter((edit) => edit.kind === 'write' && candidatePaths.has(edit.path))
      .map((edit) => [edit.path, edit.content ?? ''])
  );
  for (const candidate of candidatePaths) {
    const edited = editedByPath.get(candidate);
    if (edited !== undefined) {
      if (hasWithGTConfigCall(edited)) return true;
      continue;
    }
    try {
      if (
        fs.existsSync(candidate) &&
        hasWithGTConfigCall(fs.readFileSync(candidate, 'utf8'))
      ) {
        return true;
      }
    } catch {
      // unreadable: fall through; another candidate may be wired
    }
  }
  return false;
}

/**
 * True when the config source contains a real `withGTConfig(...)` CALL, not
 * just the substring (a comment or a string would false-pass the wiring
 * post-condition and ship an app with no dictionary/locale wiring). Accepts
 * every callee shape the transforms' own idempotency guard accepts: the
 * literal name, an aliased named import (`import { withGTConfig as w }`
 * called as `w(...)`), and a namespace member (`gt.withGTConfig(...)`) — a
 * hand-authored config in any of those shapes must not fatal an incremental
 * re-run (the re-attack config P3). Falls back to the substring on a parse
 * failure rather than false-fatal on syntax this parser cannot read.
 */
function hasWithGTConfigCall(content: string): boolean {
  if (!content.includes('withGTConfig')) return false;
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(content, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return true;
  }
  // Local names bound to the withGTConfig import (aliases included).
  const calleeNames = new Set(['withGTConfig']);
  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'withGTConfig'
      ) {
        calleeNames.add(specifier.local.name);
      }
    }
  }
  let found = false;
  const stack: object[] = [ast.program as unknown as object];
  while (stack.length > 0 && !found) {
    const node = stack.pop() as Record<string, unknown> & { type?: string };
    if (node.type === 'CallExpression') {
      const callee = node.callee as {
        type?: string;
        name?: string;
        computed?: boolean;
        property?: { type?: string; name?: string };
      };
      if (callee?.type === 'Identifier' && calleeNames.has(callee.name!)) {
        found = true;
        break;
      }
      if (
        callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property?.type === 'Identifier' &&
        callee.property.name === 'withGTConfig'
      ) {
        found = true;
        break;
      }
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            stack.push(item);
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        stack.push(value);
      }
    }
  }
  return found;
}

function isEsmNextConfig(configFile: string, cwd: string): boolean {
  if (configFile.endsWith('.mjs')) return true;
  if (!configFile.endsWith('.js')) return false;
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    );
    return pkg.type === 'module';
  } catch {
    return false;
  }
}

function isLayoutFile(file: string): boolean {
  const base = path.basename(file);
  // Must agree with emitGtFiles' isLayoutFileName (which includes layout.ts):
  // both decide which files get the layout pass / count as the [locale] layout.
  return (
    base === 'layout.tsx' ||
    base === 'layout.ts' ||
    base === 'layout.jsx' ||
    base === 'layout.js'
  );
}

function findRootFiles(cwd: string, candidates: string[]): string[] {
  return candidates
    .map((candidate) => path.join(cwd, candidate))
    .filter((file) => fs.existsSync(file));
}
