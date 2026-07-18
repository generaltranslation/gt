import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { logger } from '../../console/logger.js';
import { logErrorAndExit, promptConfirm } from '../../console/logging.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { formatFiles } from '../../hooks/postProcess.js';
import {
  getAdapter,
  supportedSourceIds,
} from '../../migrate/adapters/index.js';
import { emitGtFiles } from '../../migrate/emitGtFiles.js';
import { inlinePass } from '../../migrate/inline.js';
import { buildReport } from '../../migrate/report.js';
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

/**
 * `gt migrate`: converts a next-intl project to gt-next. Dictionary-compat
 * by default (imports/config swapped, existing catalogs preserved through
 * loadDictionary); `--inline` additionally converts safe static strings to
 * inline <T> content.
 */
export async function handleMigrateCommand(
  options: MigrateOptions,
  library: SupportedLibraries,
  cwd: string = process.cwd()
): Promise<void> {
  // Resolve the source-library adapter. --from overrides the auto-detected
  // library; an unknown/unsupported source is a clean error listing what is
  // supported (the list grows as adapters are added to the registry).
  const requestedFrom = options.from ?? library;
  const adapter = getAdapter(requestedFrom);
  if (!adapter) {
    logErrorAndExit(
      `gt migrate cannot migrate from '${requestedFrom}'. ` +
        `Supported sources: ${supportedSourceIds().join(', ')}. ` +
        (options.from
          ? 'Pass --from with a supported source, or omit it to auto-detect from your dependencies.'
          : 'This was auto-detected from your dependencies — pass --from to override.')
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
    skippedFiles: new Map(),
    stats: {},
    inlineMode: options.inline,
  };

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
    const code = fs.readFileSync(file, 'utf8');
    if (isLayoutFile(file)) {
      layouts.push(file);
      continue;
    }
    if (adapter.transformNavigation && adapter.isNavigationFile?.(code)) {
      collect(ctx, file, adapter.transformNavigation(file, code, ctx));
      continue;
    }
    if (adapter.hasProvider(code)) {
      providerFiles.push(file);
      continue;
    }
    let result = transformSourceFile(file, code, ctx);
    if (options.inline && result.skipReasons.length === 0) {
      result = applyInline(file, result.code ?? code, ctx, result);
    }
    collect(ctx, file, result);
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

  // Pass 2b: layouts, with full skip knowledge.
  for (const file of layouts) {
    const code = fs.readFileSync(file, 'utf8');
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
    let result = transformSourceFile(file, code, ctx, {
      retainNextIntlProvider: retainProviders,
    });
    if (options.inline && result.skipReasons.length === 0) {
      result = applyInline(file, result.code ?? code, ctx, result);
    }
    collect(ctx, file, result);
  }

  // Pass 3: root config files. Each config-lane transform is an optional
  // adapter method; a source with no Next.js config lane supplies none, so the
  // corresponding loop is skipped entirely.
  const transformNextConfig = adapter.transformNextConfig;
  if (transformNextConfig) {
    for (const configFile of findRootFiles(cwd, adapter.nextConfigCandidates)) {
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
    }
  }
  const transformMiddleware = adapter.transformMiddleware;
  if (transformMiddleware) {
    for (const middlewareFile of findRootFiles(
      cwd,
      adapter.middlewareCandidates
    )) {
      const code = fs.readFileSync(middlewareFile, 'utf8');
      collect(
        ctx,
        middlewareFile,
        transformMiddleware(middlewareFile, code, ctx)
      );
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
    const code = fs.readFileSync(routing.requestFile, 'utf8');
    collect(
      ctx,
      routing.requestFile,
      transformRequestConfig(routing.requestFile, code)
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
  for (const edit of ctx.edits) {
    if (edit.kind === 'delete') {
      fs.rmSync(edit.path, { force: true });
    } else {
      fs.mkdirSync(path.dirname(edit.path), { recursive: true });
      fs.writeFileSync(edit.path, edit.content ?? '');
      writtenFiles.push(edit.path);
    }
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

function applyInline(
  file: string,
  code: string,
  ctx: MigrationContext,
  base: SourceResult
): SourceResult {
  const inlined = inlinePass(file, code, ctx);
  if (inlined.skipReasons.length > 0 || inlined.code === null) {
    return base;
  }
  return {
    code: inlined.code,
    todos: [...base.todos, ...inlined.todos],
    skipReasons: [],
    usedRich: base.usedRich || inlined.usedRich,
  };
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
