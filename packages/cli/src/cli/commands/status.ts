import chalk from 'chalk';
import { logger } from '../../console/logger.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { noFilesError } from '../../console/index.js';
import { coveragePercent, displayStatus } from '../../console/displayStatus.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import { aggregateFiles } from '../../formats/files/aggregateFiles.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { validateJsonSchema } from '../../formats/json/utils.js';
import { readLockfile } from '../../fs/config/downloadedVersions.js';
import {
  computeStatus,
  type JsonSchemaResolution,
  type LocaleStatus,
} from '../../translation/status/computeStatus.js';
import type {
  SharedFlags,
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { isInlineLibrary } from '../../types/libraries.js';

// Only the flags attachStatusFlags actually attaches (attachValidateFlags
// plus the status-specific ones) — not the whole TranslateFlags surface
export type StatusFlags = SharedFlags & {
  jsconfig?: string;
  dictionary?: string;
  src?: string[];
  inline?: boolean;
  ci?: boolean;
  minCoverage?: string;
  verbose?: boolean;
};

export type StatusEvaluation = {
  /** Locales whose coverage is below the minimum */
  failingLocales: string[];
  /** Locales with zero measurable units — misconfiguration or offline-invisible setups */
  unmeasurableLocales: string[];
  /** Total ICU validation errors across locales */
  errorCount: number;
  ok: boolean;
};

/**
 * Applies the CI gate rules: per-locale coverage, validation errors, and
 * measurability. A zero-total locale reads as 100% through
 * coveragePercent, so it gets its own failing bucket instead of silently
 * passing the gate.
 */
export function evaluateStatus(
  rows: LocaleStatus[],
  minCoverage: number
): StatusEvaluation {
  const measurable = rows.filter((row) => row.total > 0);
  const failingLocales = measurable
    .filter((row) => coveragePercent(row) < minCoverage)
    .map((row) => row.locale);
  const unmeasurableLocales = rows
    .filter((row) => row.total === 0)
    .map((row) => row.locale);
  const errorCount = rows.reduce((sum, row) => sum + row.errors.length, 0);
  return {
    failingLocales,
    unmeasurableLocales,
    errorCount,
    ok:
      failingLocales.length === 0 &&
      unmeasurableLocales.length === 0 &&
      errorCount === 0,
  };
}

function parseMinCoverage(raw: string | undefined): number {
  // Number('') is 0, which would silently disable the gate
  if (typeof raw === 'string' && raw.trim() === '') return NaN;
  return Number(raw ?? 100);
}

/**
 * Reports per-locale translation coverage and validates translated
 * catalogs against the current local source of truth. Runs fully offline;
 * with --ci it exits non-zero when coverage drops below --min-coverage,
 * any translated catalog fails ICU validation, or nothing was measurable.
 */
export async function handleStatus(
  options: StatusFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<void> {
  const minCoverage = parseMinCoverage(options.minCoverage);
  if (Number.isNaN(minCoverage) || minCoverage < 0 || minCoverage > 100) {
    return logErrorAndExit('--min-coverage must be a number between 0 and 100');
  }

  if (!settings.files) {
    return logErrorAndExit(noFilesError);
  }

  // Without a local gt output, inline translations live only on the GT
  // CDN — skip the inline scan (which would reject the config) and
  // measure file-based translations only
  const hasGtOutput = Boolean(settings.files.placeholderPaths.gt);
  let files;
  if (isInlineLibrary(library) && !hasGtOutput) {
    logger.info(
      'No local output for inline translations (files.gt.output); measuring file-based translations only.'
    );
    files = (await aggregateFiles(settings)).files;
  } else {
    // Only optional TranslateFlags fields are read on this path
    files = (await collectFiles(options as TranslateFlags, settings, library))
      .files;
  }

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
      const schema = validateJsonSchema(
        settings.options ?? {},
        absoluteFilePath
      );
      if (!schema) return { kind: 'none' };
      if (schema.composite) return { kind: 'composite' };
      return { kind: 'include', include: schema.include ?? [] };
    },
  });

  displayStatus(rows, { minCoverage, verbose: Boolean(options.verbose) });

  const evaluation = evaluateStatus(rows, minCoverage);
  if (rows.length === 0 || evaluation.unmeasurableLocales.length > 0) {
    // A locale that measured nothing must not read as a passing 100% —
    // it is usually a config problem (broken include glob, wrong
    // directory) or a setup with no local translations (CDN publish,
    // composite-only)
    const which =
      rows.length === 0
        ? 'any locale'
        : evaluation.unmeasurableLocales.join(', ');
    const message = `No translatable units could be measured locally for ${which}. Check the files config include patterns and the working directory; CDN-only inline translations and composite JSON files cannot be measured offline.`;
    if (options.ci) {
      logger.error(chalk.red(message));
      return exitSync(1);
    }
    logger.warn(chalk.yellow(message));
    return;
  }
  if (evaluation.ok) {
    logger.success(
      chalk.green(
        `All ${rows.length} locales meet ${minCoverage}% coverage with no validation errors.`
      )
    );
    const staleCount = rows.reduce((sum, r) => sum + r.stale.length, 0);
    if (staleCount > 0) {
      logger.info(
        `${staleCount} stale translation${staleCount === 1 ? '' : 's'} (source changed or removed) — not counted against coverage.`
      );
    }
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
