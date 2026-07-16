import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { logger } from '../../console/logger.js';
import { logErrorAndExit, promptConfirm } from '../../console/logging.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { formatFiles } from '../../hooks/postProcess.js';
import { discoverCatalogs } from '../../migrate/discover.js';
import { emitGtFiles } from '../../migrate/emitGtFiles.js';
import { inlinePass } from '../../migrate/inline.js';
import { parseRoutingConfig } from '../../migrate/parseRoutingConfig.js';
import { buildReport } from '../../migrate/report.js';
import { transformLayoutFile } from '../../migrate/transformLayout.js';
import { transformMiddlewareFile } from '../../migrate/transformMiddleware.js';
import { transformNavigationFile } from '../../migrate/transformNavigation.js';
import { transformNextConfigFile } from '../../migrate/transformNextConfig.js';
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
  if (library !== 'next-intl') {
    logErrorAndExit(
      `gt migrate currently supports next-intl projects only, but detected '${library}'. ` +
        'react-i18next support is planned; run this from a project with next-intl in package.json.'
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

  // Pass 1: regular source files (layouts deferred — they need the final
  // skip set to decide provider retention).
  const sourceFiles = matchFiles(cwd, options.src ?? DEFAULT_SRC_PATTERNS);
  ctx.sourceFiles = sourceFiles;
  const layouts: string[] = [];
  for (const file of sourceFiles) {
    if (configLaneFiles.has(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    if (isLayoutFile(file)) {
      layouts.push(file);
      continue;
    }
    if (code.includes('createNavigation')) {
      collect(ctx, file, transformNavigationFile(file, code));
      continue;
    }
    let result = transformSourceFile(file, code, ctx);
    if (options.inline && result.skipReasons.length === 0) {
      result = applyInline(file, result.code ?? code, ctx, result);
    }
    collect(ctx, file, result);
  }

  // Pass 2: layouts, with full skip knowledge.
  for (const file of layouts) {
    const code = fs.readFileSync(file, 'utf8');
    collect(ctx, file, transformLayoutFile(file, code, ctx));
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
  return base === 'layout.tsx' || base === 'layout.jsx' || base === 'layout.js';
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
