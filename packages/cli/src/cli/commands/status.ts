import chalk from 'chalk';
import { logger } from '../../console/logger.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { noFilesError } from '../../console/index.js';
import {
  coveragePercent,
  displayStatus,
} from '../../console/displayStatus.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { validateJsonSchema } from '../../formats/json/utils.js';
import { readLockfile } from '../../fs/config/downloadedVersions.js';
import {
  computeStatus,
  type JsonSchemaResolution,
  type LocaleStatus,
} from '../../translation/status/computeStatus.js';
import type {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';

export type StatusFlags = TranslateFlags & {
  ci?: boolean;
  minCoverage?: string;
  verbose?: boolean;
};

export type StatusEvaluation = {
  /** Locales whose coverage is below the minimum */
  failingLocales: string[];
  /** Total ICU validation errors across locales */
  errorCount: number;
  ok: boolean;
};

/** Applies the CI gate rules: per-locale coverage and validation errors */
export function evaluateStatus(
  rows: LocaleStatus[],
  minCoverage: number
): StatusEvaluation {
  const failingLocales = rows
    .filter((row) => coveragePercent(row) < minCoverage)
    .map((row) => row.locale);
  const errorCount = rows.reduce((sum, row) => sum + row.errors.length, 0);
  return {
    failingLocales,
    errorCount,
    ok: failingLocales.length === 0 && errorCount === 0,
  };
}

/**
 * Reports per-locale translation coverage and validates translated
 * catalogs against the current local source of truth. Runs fully offline;
 * with --ci it exits non-zero when coverage drops below --min-coverage or
 * any translated catalog fails ICU validation.
 */
export async function handleStatus(
  options: StatusFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<void> {
  const minCoverage = Number(options.minCoverage ?? 100);
  if (Number.isNaN(minCoverage) || minCoverage < 0 || minCoverage > 100) {
    return logErrorAndExit(
      '--min-coverage must be a number between 0 and 100'
    );
  }

  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }

  const { files } = await collectFiles(options, settings, library);
  const targetLocales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );
  const fileMapping = createFileMapping(
    settings.files.resolvedPaths,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.files.transformFormats,
    targetLocales,
    settings.defaultLocale
  );
  const { entryMap } = readLockfile(settings);

  const rows = computeStatus({
    sourceFiles: files,
    fileMapping,
    lockEntries: entryMap,
    locales: targetLocales,
    cwd: process.cwd(),
    resolveJsonSchema: (absoluteFilePath): JsonSchemaResolution => {
      const schema = validateJsonSchema(settings.options ?? {}, absoluteFilePath);
      if (!schema) return { kind: 'none' };
      if (schema.composite) return { kind: 'composite' };
      return { kind: 'include', include: schema.include ?? [] };
    },
  });

  displayStatus(rows, { minCoverage, verbose: Boolean(options.verbose) });

  const evaluation = evaluateStatus(rows, minCoverage);
  if (evaluation.ok) {
    logger.success(
      chalk.green(
        `All ${rows.length} locales meet ${minCoverage}% coverage with no validation errors.`
      )
    );
    return;
  }

  const problems: string[] = [];
  if (evaluation.failingLocales.length > 0) {
    problems.push(
      `coverage below ${minCoverage}% for ${evaluation.failingLocales.join(', ')}`
    );
  }
  if (evaluation.errorCount > 0) {
    problems.push(
      `${evaluation.errorCount} validation error${evaluation.errorCount === 1 ? '' : 's'}`
    );
  }
  const summary = `Translation status check failed: ${problems.join('; ')}.`;

  if (options.ci) {
    logger.error(chalk.red(summary));
    return exitSync(1);
  }
  logger.warn(chalk.yellow(summary));
}
