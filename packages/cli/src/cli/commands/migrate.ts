import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { logger } from '../../console/logger.js';
import { exitSync, logErrorAndExit } from '../../console/logging.js';
import { noFilesError } from '../../console/index.js';
import { displayTranslateSummary } from '../../console/displayTranslateSummary.js';
import { resolveLocaleFiles } from '../../fs/config/parseFilesConfig.js';
import updateConfig from '../../fs/config/updateConfig.js';
import { stringifySortedJson } from '../../fs/sortedJson.js';
import { collectFiles } from '../../formats/files/collectFiles.js';
import {
  type Catalog,
  detectCatalogEra,
  isRecord,
  parseLegacySource,
  type LegacySources,
} from '../../migrate/catalogs.js';
import { migrateCatalogs } from '../../migrate/migrateCatalogs.js';
import { readNewMessages } from '../../migrate/newMessages.js';
import {
  completeLocales,
  summarizeReport,
  type LocaleSummary,
} from '../../migrate/summary.js';
import { uploadMigration } from '../../migrate/upload.js';
import {
  clearWarnings,
  setExitCodeForFailedUploads,
} from '../../state/translateWarnings.js';
import type {
  Settings,
  SupportedLibraries,
  TranslateFlags,
} from '../../types/index.js';
import { requireProject, resolveCanonicalLocale } from '../../utils/api.js';
import { TEMPLATE_FILE_ID } from '../../utils/constants.js';
import { BranchStep } from '../../workflows/steps/BranchStep.js';
import { hasValidLocales } from './utils/validation.js';

export type MigrateFlags = TranslateFlags & {
  from?: string;
  legacySource?: string;
  backupDir?: string;
  report?: string;
  upload?: boolean;
  fill?: boolean;
  loose?: boolean;
};

const DEFAULT_BACKUP_DIR = path.join('.gt', 'migrate-backup');

const noInlineMessagesError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'No messages were found to migrate translations to',
  why: 'gt migrate reads the messages gt translate would upload, and the source scan found none',
  fix: 'Run gt migrate from the project root after rewriting your messages, or pass --src',
});

const pre2025CatalogError = (file: string, reason: string) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: `${file} cannot be migrated`,
    why: `${reason}, the format from before July 2025, which no current hash can be derived from`,
    fix: 'Run gt translate to translate these messages again',
  });

const idKeysWarning = (file: string, count: number) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `${file} has ${count} entries keyed by id instead of hash`,
    why: 'releases before gt-next 7 and gt-react 11 keyed entries that had an id by the id',
    reassurance: 'They migrate when the default locale file holds their source',
  });

const noLegacySourceWarning = (file: string) =>
  createDiagnosticMessage({
    source: 'gt',
    severity: 'Warning',
    whatHappened: `No legacy source file was found at ${file}`,
    reassurance:
      'Messages are still matched by key and by the hash their legacy form had',
    why: 'messages whose variables were renamed can only be matched through the source',
    fix: 'Pass the legacy default locale file with --legacy-source',
  });

const noUploadWarning = createDiagnosticMessage({
  source: 'gt',
  severity: 'Warning',
  whatHappened: 'The migrated translations were not uploaded',
  why: 'the platform does not have them, so gt translate translates and bills these messages again',
  fix: 'Run gt migrate again with a project ID and without --no-upload before you run gt translate',
});

function readCatalog(file: string): Catalog | undefined {
  if (!fs.existsSync(file)) return undefined;
  const json: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  return isRecord(json) ? json : undefined;
}

function displayPath(file: string): string {
  return path.relative(process.cwd(), file) || file;
}

type LocaleFiles = {
  locale: string;
  output: string;
  legacy: string;
  backup: string;
};

function localeFiles(
  settings: Settings,
  options: MigrateFlags,
  locale: string
): LocaleFiles {
  const output = resolveLocaleFiles(settings.files!.placeholderPaths, locale)
    .gt as string;
  const backupDir = path.resolve(
    path.dirname(path.resolve(settings.config)),
    options.backupDir ?? DEFAULT_BACKUP_DIR
  );
  const backup = path.join(backupDir, path.basename(output));
  const legacy = options.from
    ? path.resolve(options.from, path.basename(output))
    : fs.existsSync(backup)
      ? backup
      : output;
  return { locale, output, legacy, backup };
}

function readLegacyCatalog(file: string): Catalog {
  const catalog = readCatalog(file) ?? {};
  const era = detectCatalogEra(catalog);
  if (era.era === 'pre-2025') {
    return logErrorAndExit(pre2025CatalogError(displayPath(file), era.reason));
  }
  if (era.idKeys > 0) logger.warn(idKeysWarning(displayPath(file), era.idKeys));
  return catalog;
}

function formatSummary(summaries: LocaleSummary[]): string {
  const rows = summaries.map(
    ({ locale, carried, migrated, filled, rejected, missing }) => {
      const moved = Object.values(migrated).reduce(
        (sum, n) => sum + (n ?? 0),
        0
      );
      return `  ${chalk.bold(locale.padEnd(8))} ${String(carried).padStart(5)} carried  ${String(moved).padStart(5)} migrated  ${String(filled).padStart(4)} filled  ${String(rejected).padStart(4)} rejected  ${String(missing).padStart(5)} missing`;
    }
  );
  return [chalk.cyan('Migration by locale:'), ...rows].join('\n');
}

export async function handleMigrate(
  options: MigrateFlags,
  settings: Settings,
  library: SupportedLibraries
): Promise<void> {
  if (!hasValidLocales(settings)) return exitSync(1);
  if (!settings.files?.placeholderPaths.gt) {
    return logErrorAndExit(noFilesError);
  }
  const willUpload =
    options.upload !== false && !options.dryRun && !!settings.projectId;
  if (!willUpload && !options.dryRun) logger.warn(noUploadWarning);

  const { files } = await collectFiles(
    { ...options, publish: false },
    { ...settings, publish: false },
    library
  );
  const template = files.find((file) => file.fileId === TEMPLATE_FILE_ID);
  if (!template) return logErrorAndExit(noInlineMessagesError);
  const messages = readNewMessages(
    JSON.parse(template.content) as Record<string, unknown>,
    (template.formatMetadata ?? {}) as Record<string, unknown>
  );

  const locales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );
  const filesByLocale = locales.map((locale) =>
    localeFiles(settings, options, locale)
  );
  const catalogs: Record<string, Catalog> = {};
  for (const { locale, output, legacy } of filesByLocale) {
    catalogs[locale] = {
      ...readLegacyCatalog(legacy),
      ...(legacy !== output ? readCatalog(output) : {}),
    };
  }

  const sourceFile = options.legacySource
    ? path.resolve(options.legacySource)
    : localeFiles(settings, options, settings.defaultLocale).legacy;
  const sourceJson = readCatalog(sourceFile);
  let sources: LegacySources | undefined;
  if (sourceJson) {
    if (detectCatalogEra(sourceJson).era === 'pre-2025') {
      return logErrorAndExit(
        pre2025CatalogError(
          displayPath(sourceFile),
          'it uses 64-character keys'
        )
      );
    }
    sources = parseLegacySource(sourceJson);
  } else {
    logger.warn(noLegacySourceWarning(displayPath(sourceFile)));
  }

  const result = migrateCatalogs({
    messages,
    sources,
    catalogs,
    locales,
    defaultLocale: settings.defaultLocale,
    validationLocale: resolveCanonicalLocale,
    fill: options.fill !== false,
    loose: options.loose === true,
  });
  const summaries = summarizeReport(result.report);
  logger.message(formatSummary(summaries));
  if (options.report) {
    await fs.promises.mkdir(path.dirname(path.resolve(options.report)), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.resolve(options.report),
      JSON.stringify(result.report, null, 2) + '\n'
    );
    logger.step(`Wrote the migration report to ${options.report}`);
  }

  if (options.dryRun) {
    logger.success('Dry run: no files were written or uploaded.');
    return printNextStep(summaries);
  }

  const contents: Record<string, string> = {};
  for (const { locale, output, backup } of filesByLocale) {
    if (fs.existsSync(output) && !fs.existsSync(backup)) {
      await fs.promises.mkdir(path.dirname(backup), { recursive: true });
      await fs.promises.copyFile(output, backup);
    }
    const catalog = result.catalogs[locale];
    if (Object.keys(catalog).length === 0 && !fs.existsSync(output)) continue;
    contents[locale] = stringifySortedJson(catalog);
    await fs.promises.mkdir(path.dirname(output), { recursive: true });
    await fs.promises.writeFile(output, contents[locale]);
  }
  logger.step(
    `Wrote ${Object.keys(contents).length} migrated translation file${Object.keys(contents).length === 1 ? '' : 's'}; the previous files are in ${displayPath(path.dirname(filesByLocale[0]?.backup ?? DEFAULT_BACKUP_DIR))}`
  );

  if (willUpload) {
    const client = requireProject(settings);
    const branchData = await new BranchStep(client, settings).run();
    if (!branchData) {
      return logErrorAndExit('The branch could not be resolved.');
    }
    const uploaded = await uploadMigration({
      client,
      settings,
      branchData,
      template,
      translations: Object.fromEntries(
        Object.entries(contents).filter(
          ([locale]) => Object.keys(result.catalogs[locale]).length > 0
        )
      ),
      completeLocales: completeLocales(result.report),
    });
    if (uploaded.sourceUploaded) {
      if (settings.omitConfigIds) {
        await updateConfig(settings.config, {
          _versionId: null,
          _branchId: null,
        });
      } else {
        await updateConfig(settings.config, {
          _versionId: template.versionId,
          _branchId: branchData.currentBranch.id,
        });
      }
    }
    if (!settings.branchOptions.enabled && !settings.omitConfigIds) {
      await updateConfig(settings.config, { _branchId: null });
    }
  }

  printNextStep(summaries);
  displayTranslateSummary();
  setExitCodeForFailedUploads();
  clearWarnings();
}

function printNextStep(summaries: LocaleSummary[]): void {
  const missing = summaries.reduce(
    (sum, summary) => sum + summary.missing + summary.rejected,
    0
  );
  const chars = summaries.reduce(
    (sum, summary) => sum + summary.missingChars,
    0
  );
  logger.message(
    missing === 0
      ? 'Every message has a migrated translation. Run gt translate to confirm nothing is left.'
      : `Run gt translate next: ${missing} translation${missing === 1 ? '' : 's'} (about ${chars} characters of source text) still need translating.`
  );
}
