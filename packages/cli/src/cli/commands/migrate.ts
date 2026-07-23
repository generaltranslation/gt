import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import { logger } from '../../console/logger.js';
import {
  logErrorAndExit,
  promptConfirm,
  promptLocale,
  promptLocaleList,
  promptText,
} from '../../console/logging.js';
import { formatFiles } from '../../hooks/postProcess.js';
import type { SupportedLibraries } from '../../types/index.js';
import { Libraries } from '../../types/libraries.js';
import { installPackage } from '../../utils/installPackage.js';
import { getPackageJson, isPackageInstalled } from '../../utils/packageJson.js';
import {
  detectPackageManagerWithRoot,
  getPackageManager,
} from '../../utils/packageManager.js';
import type { PackageManager } from '../../utils/packageManager.js';
import { loadMigrateEngine } from './migrateEngineLoader.js';
import type {
  MigrateIO,
  MigrateOptions,
  MigrationContext,
} from '@generaltranslation/migrate';

/**
 * `gt migrate`: converts an existing i18n setup in a Next.js App Router project
 * to gt-next. This command is a thin shell around the migration engine, which
 * ships as a separate on-demand package (`@generaltranslation/migrate`) so the
 * gt CLI stays small for the majority of users who never migrate. The engine is
 * ~10k lines of transforms; the CLI only fetches it the first time `gt migrate`
 * runs (see migrateEngineLoader.ts), then keeps it cached.
 *
 * The split: the engine (`runMigration`) owns all of the pass orchestration and
 * returns the planned edits plus the report data without touching disk or any
 * CLI-only concern. It stays UI-free by taking an `io` object; this shell
 * injects the logger, prompts, and git guard. The shell then applies the
 * buffered edits, installs gt-next, formats, and prints/writes the report:
 * everything that is genuinely CLI- or filesystem-side.
 */
export async function handleMigrateCommand(
  options: MigrateOptions,
  library: SupportedLibraries,
  cwd: string = process.cwd()
): Promise<void> {
  // The host callbacks the engine needs for anything interactive or
  // process-level. Prompt option shapes match the engine's MigrateIO exactly,
  // so the console helpers forward verbatim.
  const io: MigrateIO = {
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
    fatal: (message) => logErrorAndExit(message),
    guardGit: (dir, opts) => guardGitState(dir, opts),
    promptConfirm: (opts) => promptConfirm(opts),
    promptText: (opts) => promptText(opts),
    promptLocale: (opts) => promptLocale(opts),
    promptLocaleList: (opts) => promptLocaleList(opts),
  };

  // Resolve the engine (workspace dep in the monorepo, the user's project, or a
  // one-time tool-cache install). Loader handles the diagnostics and the
  // interface-version check; it never returns an incompatible engine.
  const engine = await loadMigrateEngine(cwd);

  // The engine runs every pass and hands back the fully populated context (the
  // buffered edits, todos, warnings, skips, stats). Nothing is written yet.
  const ctx: MigrationContext = await engine.runMigration(
    options,
    library,
    io,
    cwd
  );

  if (options.dryRun) {
    const report = engine.buildReport(
      ctx,
      true,
      !(await isGtNextInstalled(cwd))
    );
    logger.message(report);
    echoWarnings(ctx);
    logger.endCommand('Dry run complete; nothing was written.');
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
        source: 'gt',
        severity: 'Error',
        whatHappened: `Applying the migration failed after ${applied} of ${ctx.edits.length} planned file changes, so the project is partially migrated`,
        fix: 'Fix the underlying filesystem error and restore the pre-migration state with `git checkout .` (plus `git clean -fd` for newly created files) before re-running.',
        wayOut:
          'If you ran with --allow-dirty on a tree with uncommitted changes, restore those files from your own stash or backup instead.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
  }

  // The rewritten files import gt-next; install it so the app builds.
  let gtNextMissing = !(await isGtNextInstalled(cwd));
  if (gtNextMissing) {
    // In a monorepo the lockfile lives at the workspace root, not in the app
    // directory the migration ran in, so leaf-only detection would miss it.
    // Resolve the nearest workspace root: npm must run the install at the
    // root targeting the member (running it in the leaf would start a second,
    // detached dependency tree); the workspace-native managers resolve the
    // root themselves when run from the leaf.
    let packageManager: PackageManager | null = null;
    let installCwd = cwd;
    const installExtraArgs: string[] = [];
    const detected = detectPackageManagerWithRoot(cwd);
    if (detected) {
      packageManager = detected.packageManager;
      if (detected.root !== path.resolve(cwd) && packageManager.id === 'npm') {
        installCwd = detected.root;
        installExtraArgs.push(
          `--workspace=${path.relative(detected.root, path.resolve(cwd))}`
        );
      }
    } else {
      // When detection fails everywhere, getPackageManager falls back to an
      // interactive prompt. A non-interactive run cannot answer it, and dying
      // on prompt EOF here would end the run after the edits were written but
      // before the report exists, so detection failure falls through to the
      // report's manual-install step instead.
      try {
        packageManager = await getPackageManager(
          cwd,
          undefined,
          !process.stdin.isTTY
        );
      } catch {
        logger.warn(
          createDiagnosticMessage({
            source: 'gt',
            severity: 'Warning',
            whatHappened: `Could not detect the package manager, so ${Libraries.GT_NEXT} was not installed`,
            fix: 'Install it by hand; the report includes the manual install step.',
          })
        );
      }
    }
    if (packageManager !== null) {
      const spinner = logger.createSpinner('timer');
      spinner.start(
        `Installing ${Libraries.GT_NEXT} with ${packageManager.name}...`
      );
      try {
        await installPackage(
          Libraries.GT_NEXT,
          packageManager,
          false,
          installCwd,
          installExtraArgs
        );
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
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened: 'Post-migration formatting failed',
        fix: 'Run your formatter over the changed files.',
      })
    );
  }

  const report = engine.buildReport(ctx, false, gtNextMissing);
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
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Warning',
        whatHappened: 'Could not write gt-migrate-report.md',
        reassurance: 'The full report is printed above.',
      })
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

async function isGtNextInstalled(cwd: string): Promise<boolean> {
  const packageJson = await getPackageJson(cwd);
  if (!packageJson) return false;
  return isPackageInstalled(Libraries.GT_NEXT, packageJson, false, true);
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
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: 'Working tree has uncommitted changes',
          why: 'the migration rewrites files in place and should stay reviewable',
          fix: 'Commit or stash first, or pass --allow-dirty to override.',
        })
      );
    }
  } catch {
    logger.warn(
      'Not a git repository; proceeding without a safety checkpoint.'
    );
  }
}
