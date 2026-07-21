import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { logger } from '../../console/logger.js';
import { logErrorAndExit, promptConfirm } from '../../console/logging.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { formatFiles } from '../../hooks/postProcess.js';
import {
  getAdapter,
  supportedSourceIds,
  type SourceAdapter,
} from '../../migrate/adapters/index.js';
import { emitGtFiles } from '../../migrate/emitGtFiles.js';
import { resolveCatalogsInteractively } from '../../migrate/promptFallbacks.js';
import { buildReport } from '../../migrate/report.js';
import {
  hasDependency,
  resolveMigrationSource,
} from '../../migrate/resolveSource.js';
import { transformLayoutFile } from '../../migrate/transformLayout.js';
import { transformSourceFile } from '../../migrate/transformSource.js';
import type {
  MigrateOptions,
  MigrationContext,
  SourceResult,
} from '../../migrate/types.js';
import type { SupportedLibraries } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { installPackage } from '../../utils/installPackage.js';
import { getPackageJson, isPackageInstalled } from '../../utils/packageJson.js';
import { getPackageManager } from '../../utils/packageManager.js';
import type { PackageManager } from '../../utils/packageManager.js';

/**
 * `gt migrate`: converts an existing i18n setup in a Next.js App Router
 * project to gt-next. Sources are handled by pluggable adapters selected with
 * the required `--from` flag (next-intl, react-intl, react-i18next today; the
 * registry lives in ../migrate/adapters/). This doc describes the core
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
 *   gt-next fix from #1909; with it, both migration modes build and serve
 *   cleanly.
 */
export async function handleMigrateCommand(
  options: MigrateOptions,
  library: SupportedLibraries,
  cwd: string = process.cwd()
): Promise<void> {
  // Resolve the source-library adapter from --from (required by the CLI). An
  // unknown/unsupported source is a clean error listing what is supported (the
  // list grows as adapters are added to the registry). determineLibrary
  // collapses react-i18next / next-i18next / bare i18next all to 'i18next';
  // resolveMigrationSource resolves the concrete flavor (or the scoped OUT
  // message) before the registry lookup, so a concrete --from
  // (e.g. react-i18next) passes straight through.
  const resolution = resolveMigrationSource(options.from, cwd);
  if (resolution.kind === 'error') {
    logErrorAndExit(resolution.message);
  }
  const adapter = getAdapter(resolution.id);
  if (!adapter) {
    logErrorAndExit(
      `gt migrate cannot migrate from '${resolution.id}'. ` +
        `Supported sources: ${supportedSourceIds().join(', ')}.`
    );
  }

  // --from is user input, not detection, so confirm the requested library is
  // actually reachable from cwd (declared here or hoisted into a shared
  // node_modules); otherwise the run would "succeed" (write scaffolding) while
  // leaving every source file untouched, since no import matches.
  if (!isSourceLibraryInstalled(cwd, adapter)) {
    logErrorAndExit(
      `--from ${options.from} was passed, but ${adapter.displayName} was not ` +
        'found in this project (checked package.json and node_modules). Install ' +
        'it first, or correct the --from value, then re-run.'
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
    logger.warn(
      `Detected '${library}' in this project; migrating from ${adapter.displayName} per --from.`
    );
  }

  // If next-intl is the target but react-i18next is also installed, the user
  // may have meant the other surface; point them at the flag so a project does
  // not get silently half-migrated (the m2 finding).
  if (adapter.id === 'next-intl' && hasDependency(cwd, 'react-i18next')) {
    logger.warn(
      'Also detected react-i18next in your dependencies. This run migrates next-intl only; ' +
        're-run with --from react-i18next to target the react-i18next surface instead.'
    );
  }

  guardGitState(cwd, options);

  if (!options.yes && !options.dryRun) {
    const proceed = await promptConfirm({
      message:
        'This will rewrite source files in place (your translations are preserved). ' +
        'Make sure changes are committed or stashed. Continue?',
      defaultValue: true,
    });
    if (!proceed) logErrorAndExit('Migration cancelled.');
  }

  const routing = adapter.parseRoutingConfig(cwd);
  let catalogs: Awaited<ReturnType<typeof adapter.discoverCatalogs>>;
  try {
    catalogs = await adapter.discoverCatalogs(cwd, routing);
    if (!catalogs && adapter.id === 'next-intl') {
      // Detection came up empty, or found catalogs but not one per configured
      // locale (discover warns with the specifics first): ask the user
      // directly (same building blocks as `gt setup`) instead of guessing.
      // Returns null when the session is non-interactive, which falls through
      // to the hard error below. Gated to next-intl: the other adapters'
      // discovery does re-nesting/ICU conversion that a raw directory prompt
      // would bypass, so their misses stay hard errors until each grows its
      // own prompt path.
      catalogs = await resolveCatalogsInteractively(cwd, routing);
    }
  } catch (error) {
    // e.g. a malformed locale JSON — nothing has been written yet.
    logErrorAndExit(error instanceof Error ? error.message : String(error));
  }
  if (!catalogs) {
    logErrorAndExit(
      `Could not locate ${adapter.displayName} message catalogs (looked for the request ` +
        "config's import path, then messages/, src/messages/, locales/). " +
        'Pass --src or add a JSON catalog per locale and retry.'
    );
  }
  logger.info(
    `Found catalogs for [${catalogs.locales.join(', ')}] in ${path.relative(cwd, catalogs.dir) || '.'} ` +
      `(default: ${catalogs.defaultLocale})`
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
  // through the generic source pass — they'd register as skips. The candidate
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
  // files deferred — they need the final skip set to decide provider retention).
  // Default scope covers the conventional i18n config directory too — the
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
  // The whole project, independent of scope — teardown and still-imported
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
  // known — see the deferred passes below.
  const providerFiles: string[] = [];
  for (const file of sourceFiles) {
    if (configLaneFiles.has(file)) continue;
    try {
      const code = fs.readFileSync(file, 'utf8');
      if (isLayoutFile(file)) {
        layouts.push(file);
        continue;
      }
      if (adapter.navigation?.isNavigationFile(code)) {
        const navigation = adapter.navigation.transformNavigation(
          file,
          code,
          ctx
        );
        if (navigation.code !== null || navigation.skipReasons.length > 0) {
          collect(ctx, file, navigation);
          continue;
        }
        // The transform claimed nothing: the detection was a false match (a
        // comment, an unrelated helper with the same name). Fall through to
        // the generic source pass so real source-library usage in this file
        // is still converted or registered as a skip.
      }
      if (adapter.hasProvider(code)) {
        providerFiles.push(file);
        continue;
      }
      collect(ctx, file, runSourceTransform(file, code, ctx));
    } catch (error) {
      recordTransformError(ctx, file, error);
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
    if (adapter.projectUsagePattern.test(content)) {
      ctx.skippedFiles.set(file, [
        `uses ${adapter.displayName} but was not scanned (outside the --src scope or the default globs) — include it or convert it manually`,
      ]);
    }
  }

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
        collect(ctx, file, classified);
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
    collect(ctx, file, runLayoutTransform(adapter, file, code, ctx));
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
      collect(ctx, file, runSourceTransform(file, code, ctx, retainProviders));
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
        collect(ctx, configFile, transformNextConfig(configFile, code, ctx));
        if (isEsmNextConfig(configFile, cwd)) {
          // gt-next/config's ESM bundle currently breaks under a native-ESM
          // config ("require is not defined" resolving the Next.js version).
          ctx.todos.push({
            file: configFile,
            reason:
              'this config loads as native ESM, where gt-next/config (<= 11.0.9) fails with "require is not defined" — rename it to next.config.ts (Next.js compiles it to CJS) until gt-next ships an ESM-safe config entry',
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
  // skipped files, but gt-next's middleware no longer feeds it a locale —
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

  // Next.js ignores root-level middleware when the app lives in src/ —
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
        'middleware file is at the project root but the app lives in src/ — Next.js ignores it there; move it to src/ or locale routing will not run',
    });
  }

  // Count real source transforms before emitGtFiles adds the gt-next
  // scaffolding (config, loaders, resolvers). ctx.edits holds only transform
  // writes at this point.
  const transformedSourceFiles = ctx.edits.filter(
    (edit) => edit.kind === 'write'
  ).length;

  ctx.edits.push(...emitGtFiles(ctx));

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
    // Under --dry-run nothing is written yet (the write loop is past the
    // early return below), so describe the scaffolding as prospective.
    const scaffoldingClause = options.dryRun
      ? 'The gt-next scaffolding would still be written'
      : 'The gt-next scaffolding was still written';
    logger.warn(
      `Nothing to migrate: no files importing ${adapter.displayName} were found. ` +
        `Is ${options.from} really this project's i18n library? ` +
        `${scaffoldingClause}; re-run with --from <library> ` +
        'if you targeted the wrong source.'
    );
  }

  if (options.dryRun) {
    const report = buildReport(ctx, true, !(await isGtNextInstalled(cwd)));
    logger.message(report);
    echoWarnings(ctx);
    logger.endCommand('Dry run complete — nothing was written.');
    return;
  }

  const writtenFiles: string[] = [];
  let applied = 0;
  try {
    for (const edit of ctx.edits) {
      if (edit.kind === 'delete') {
        fs.rmSync(edit.path, { force: true });
      } else {
        fs.mkdirSync(path.dirname(edit.path), { recursive: true });
        fs.writeFileSync(edit.path, edit.content ?? '');
        writtenFiles.push(edit.path);
      }
      applied += 1;
    }
  } catch (error) {
    // Buffering means nothing is touched until every transform succeeds, but
    // a filesystem error mid-loop (permissions, disk full) still strands a
    // partial write; name the damage and the way back instead of letting a
    // raw stack trace surface.
    if (writtenFiles.length > 0) {
      logger.warn(
        `Files already rewritten: ${writtenFiles
          .map((file) => path.relative(cwd, file))
          .join(', ')}`
      );
    }
    logErrorAndExit(
      createDiagnosticMessage({
        whatHappened: `Applying the migration failed after ${applied} of ${ctx.edits.length} planned file changes, so the project is partially migrated`,
        fix: 'Fix the underlying filesystem error and restore the pre-migration state with `git checkout .` (plus `git clean -fd` for newly created files) before re-running.',
        wayOut:
          'If you ran with --allow-dirty on a tree with uncommitted changes, restore those files from your own stash or backup instead.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }

  // The rewritten files import gt-next — install it so the app builds.
  let gtNextMissing = !(await isGtNextInstalled(cwd));
  if (gtNextMissing) {
    // When detection fails (no lockfile), getPackageManager falls back to an
    // interactive prompt. A non-interactive run cannot answer it, and dying on
    // prompt EOF here would end the run after the edits were written but
    // before the report exists, so detection failure falls through to the
    // report's manual-install step instead.
    let packageManager: PackageManager | null = null;
    try {
      packageManager = await getPackageManager(
        cwd,
        undefined,
        !process.stdin.isTTY
      );
    } catch {
      logger.warn(
        `Could not detect the package manager, so ${Libraries.GT_NEXT} was not installed; the report includes the manual install step.`
      );
    }
    if (packageManager !== null) {
      const spinner = logger.createSpinner('timer');
      spinner.start(
        `Installing ${Libraries.GT_NEXT} with ${packageManager.name}...`
      );
      try {
        await installPackage(Libraries.GT_NEXT, packageManager, false, cwd);
        spinner.stop(chalk.green(`Installed ${Libraries.GT_NEXT}.`));
        gtNextMissing = false;
      } catch {
        // installPackage already logged the manual install command.
        spinner.stop(chalk.yellow(`Could not install ${Libraries.GT_NEXT}.`));
      }
    }
  }

  try {
    await formatFiles(
      writtenFiles.filter((file) => /\.[cm]?[jt]sx?$/.test(file))
    );
  } catch {
    logger.warn(
      'Post-migration formatting failed — run your formatter over the changed files.'
    );
  }

  const report = buildReport(ctx, false, gtNextMissing);
  const reportPath = path.join(cwd, 'gt-migrate-report.md');
  // Print before writing: if the report file cannot land (disk full after the
  // migration writes, a permission error on the project root), the user still
  // gets the full report on the console instead of a raw stack trace over a
  // migrated tree the dirty-tree guard would then block from a clean re-run.
  logger.message(report);
  let reportWritten = true;
  try {
    fs.writeFileSync(reportPath, report);
  } catch {
    reportWritten = false;
    logger.warn(
      'Could not write gt-migrate-report.md; the full report is printed above.'
    );
  }
  echoWarnings(ctx);
  logger.endCommand(
    reportWritten
      ? `Migration written (${writtenFiles.length} files). Full report: ${path.relative(cwd, reportPath)}`
      : `Migration written (${writtenFiles.length} files). Report printed above (the report file could not be written).`
  );
}

/** Echoes the loud, correctness-level warnings to the console at the end of the
 *  run so they are seen even if the user does not read the full report. */
function echoWarnings(ctx: MigrationContext): void {
  for (const warning of ctx.warnings ?? []) {
    logger.warn(warning);
  }
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
 * Records a whole-file skip for an uncaught transform error, so one file
 * blowing up (e.g. a babel throw during a rewrite) degrades to a reported skip
 * with the file left untouched, instead of aborting the entire command with a
 * raw stack trace. The skip surfaces in the report's manual-migration section.
 */
function recordTransformError(
  ctx: MigrationContext,
  file: string,
  error: unknown
): void {
  const message = error instanceof Error ? error.message : String(error);
  ctx.skippedFiles.set(file, [
    `internal transform error on ${path.relative(ctx.cwd, file)}: ${message} — file left untouched`,
  ]);
}

function collect(
  ctx: MigrationContext,
  file: string,
  result: SourceResult
): void {
  if (result.skipReasons.length > 0) {
    ctx.skippedFiles.set(file, result.skipReasons);
    return;
  }
  ctx.todos.push(...result.todos);
  if (result.code !== null) {
    ctx.edits.push({ path: file, kind: 'write', content: result.code });
  }
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
 * root) — exactly the directories Node's resolver searches. A hoisted monorepo
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

async function isGtNextInstalled(cwd: string): Promise<boolean> {
  const packageJson = await getPackageJson(cwd);
  if (!packageJson) return false;
  return isPackageInstalled(Libraries.GT_NEXT, packageJson, false, true);
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

function guardGitState(cwd: string, options: MigrateOptions): void {
  if (options.allowDirty) return;
  try {
    const status = execSync('git status --porcelain', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (status.length > 0) {
      logErrorAndExit(
        'Working tree has uncommitted changes. Commit or stash first so the ' +
          'migration is reviewable (or pass --allow-dirty).'
      );
    }
  } catch {
    logger.warn(
      'Not a git repository — proceeding without a safety checkpoint.'
    );
  }
}
