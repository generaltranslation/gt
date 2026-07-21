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
import { discoverCatalogs } from '../../migrate/discover.js';
import { emitGtFiles } from '../../migrate/emitGtFiles.js';
import { parseRoutingConfig } from '../../migrate/parseRoutingConfig.js';
import { resolveCatalogsInteractively } from '../../migrate/promptFallbacks.js';
import { buildReport } from '../../migrate/report.js';
import { transformLayoutFile } from '../../migrate/transformLayout.js';
import { transformMiddlewareFile } from '../../migrate/transformMiddleware.js';
import { transformNavigationFile } from '../../migrate/transformNavigation.js';
import { transformNextConfigFile } from '../../migrate/transformNextConfig.js';
import { transformRequestConfigFile } from '../../migrate/transformRequestConfig.js';
import {
  hasNextIntlProvider,
  transformSourceFile,
} from '../../migrate/transformSource.js';
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

/**
 * `gt migrate`: converts a next-intl Next.js App Router project to gt-next.
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
 * react-i18next is detected (`determineLibrary`) but not yet supported;
 * the required `--from` flag gates the run today, and another library
 * needs its own transform set behind the same flag.
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
  if (options.from !== 'next-intl') {
    logErrorAndExit(
      `gt migrate currently supports --from next-intl only (got '${options.from}'). ` +
        'react-i18next support is planned.'
    );
  }
  if (library !== 'next-intl' && library !== 'base') {
    logger.warn(
      `Detected '${library}' in this project; migrating from next-intl per --from.`
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

  const routing = parseRoutingConfig(cwd);
  let catalogs: Awaited<ReturnType<typeof discoverCatalogs>>;
  try {
    catalogs = await discoverCatalogs(cwd, routing);
    if (!catalogs) {
      // Detection came up empty, or found catalogs but not one per configured
      // locale (discover warns with the specifics first): ask the user
      // directly (same building blocks as `gt setup`) instead of guessing.
      // Returns null when the session is non-interactive, which falls through
      // to the hard error below.
      catalogs = await resolveCatalogsInteractively(cwd, routing);
    }
  } catch (error) {
    // e.g. a malformed locale JSON — nothing has been written yet.
    logErrorAndExit(error instanceof Error ? error.message : String(error));
  }
  if (!catalogs) {
    logErrorAndExit(
      'Could not locate next-intl message catalogs (looked for the request ' +
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
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    // -c/--config; commander's default resolves an existing root
    // gt.config.json or '' when none exists yet.
    configFile: options.config
      ? path.resolve(cwd, options.config)
      : path.join(cwd, 'gt.config.json'),
  };

  // Files owned by the config lane (pass 3 / emitGtFiles) must not go
  // through the generic source pass — they'd register as skips.
  const configLaneFiles = new Set(
    [
      routing.routingFile,
      routing.requestFile,
      ...findRootFiles(cwd, [
        'next.config.ts',
        'next.config.js',
        'next.config.mjs',
        'middleware.ts',
        'middleware.js',
        'src/middleware.ts',
        'src/middleware.js',
        'proxy.ts',
        'src/proxy.ts',
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
    const code = fs.readFileSync(file, 'utf8');
    if (isLayoutFile(file)) {
      layouts.push(file);
      continue;
    }
    if (code.includes('createNavigation')) {
      const navigation = transformNavigationFile(file, code, ctx);
      if (navigation.code !== null || navigation.skipReasons.length > 0) {
        collect(ctx, file, navigation);
        continue;
      }
      // The transform claimed nothing: the string was a false match (a
      // comment, an unrelated helper with the same name). Fall through to
      // the generic source pass so real next-intl usage in this file is
      // still converted or registered as a skip.
    }
    if (hasNextIntlProvider(code)) {
      providerFiles.push(file);
      continue;
    }
    collect(ctx, file, transformSourceFile(file, code, ctx));
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
    if (
      /(?:from\s+|import\s*\(\s*|import\s*|require\s*\(\s*)['"]next-intl(?:\/|['"])/.test(
        content
      )
    ) {
      ctx.skippedFiles.set(file, [
        'uses next-intl but was not scanned (outside the --src scope or the default globs) — include it or convert it manually',
      ]);
    }
  }

  // Pass 2a: classify deferred provider files. A provider file that must be
  // skipped for its own reasons (an unsupported next-intl API alongside the
  // provider) contributes to the skip set, which in turn flips the retention
  // decision for the *other* deferred files and the layouts. Skip status is
  // independent of retainNextIntlProvider (the transform is pure), so we can
  // settle every skip here, before anyone reads ctx.skippedFiles.size.
  const providerFilesToApply: string[] = [];
  for (const file of providerFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const classified = transformSourceFile(file, code, ctx);
    if (classified.skipReasons.length > 0) {
      collect(ctx, file, classified);
    } else {
      providerFilesToApply.push(file);
    }
  }

  // Pass 2b: layouts. A layout's own skip flips provider retention for every
  // other layout (transformLayoutFile reads ctx.skippedFiles live), and a
  // flip to retention can itself skip another layout (the unsafe-async
  // fallback only exists while a provider is retained), so classify all
  // layouts to a fixed point before applying any of them. Otherwise a root
  // layout processed first drops NextIntlClientProvider that a later-skipped
  // nested layout still needs. Skips only accumulate (retention never flips
  // back off), so each round either adds a skip or ends the loop.
  const layoutSources = new Map(
    layouts.map((file) => [file, fs.readFileSync(file, 'utf8')] as const)
  );
  for (;;) {
    let newSkips = false;
    for (const [file, code] of layoutSources) {
      if (ctx.skippedFiles.has(file)) continue;
      const classified = transformLayoutFile(file, code, ctx);
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
    collect(ctx, file, transformLayoutFile(file, code, ctx));
  }

  // Pass 2c: apply the deferred provider files now that the skip set is final
  // (layouts can add skips too). Retention matches the layout decision, so a
  // partial migration keeps NextIntlClientProvider (and its messages wiring)
  // for the skipped files, while a clean full migration swaps it for
  // <GTProvider> exactly as a single-pass run would.
  const retainProviders = ctx.skippedFiles.size > 0;
  for (const file of providerFilesToApply) {
    const code = fs.readFileSync(file, 'utf8');
    collect(
      ctx,
      file,
      transformSourceFile(file, code, ctx, {
        retainNextIntlProvider: retainProviders,
      })
    );
  }

  // Pass 3: root config files.
  for (const configFile of findRootFiles(cwd, [
    'next.config.ts',
    'next.config.js',
    'next.config.mjs',
  ])) {
    const code = fs.readFileSync(configFile, 'utf8');
    collect(ctx, configFile, transformNextConfigFile(configFile, code, ctx));
    if (isEsmNextConfig(configFile, cwd)) {
      // gt-next/config's ESM bundle currently breaks under a native-ESM
      // config ("require is not defined" resolving the Next.js version).
      ctx.todos.push({
        file: configFile,
        reason:
          'this config loads as native ESM, where gt-next/config (<= 11.0.9) fails with "require is not defined" — rename it to next.config.ts (Next.js compiles it to CJS) until gt-next ships an ESM-safe config entry',
      });
    }
  }
  for (const middlewareFile of findRootFiles(cwd, [
    'middleware.ts',
    'middleware.js',
    'src/middleware.ts',
    'src/middleware.js',
    'proxy.ts',
    'src/proxy.ts',
  ])) {
    const code = fs.readFileSync(middlewareFile, 'utf8');
    collect(
      ctx,
      middlewareFile,
      transformMiddlewareFile(middlewareFile, code, ctx)
    );
  }

  // Partial migrations keep next-intl's request config alive for skipped
  // files, but gt-next's middleware no longer feeds it a locale — rewire its
  // fallback to getLocale() so skipped files render the page locale instead
  // of the default one.
  if (
    ctx.skippedFiles.size > 0 &&
    routing.requestFile &&
    fs.existsSync(routing.requestFile)
  ) {
    const code = fs.readFileSync(routing.requestFile, 'utf8');
    collect(
      ctx,
      routing.requestFile,
      transformRequestConfigFile(routing.requestFile, code)
    );
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

  ctx.edits.push(...emitGtFiles(ctx));

  if (options.dryRun) {
    const report = buildReport(ctx, true, !(await isGtNextInstalled(cwd)));
    logger.message(report);
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
    const packageManager = await getPackageManager(cwd);
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
  fs.writeFileSync(reportPath, report);
  logger.message(report);
  logger.endCommand(
    `Migration written (${writtenFiles.length} files). Full report: ${path.relative(cwd, reportPath)}`
  );
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
