import fs from 'node:fs';
import path from 'node:path';
import {
  findLocaleTwinPlaceholders,
  LOCALE_TWIN_MANIFEST_FILE,
  parseLocaleTwinManifest,
  type LocaleTwinEntries,
  type LocaleTwinManifest,
} from 'generaltranslation/internal';
import {
  generateLocaleTwins,
  type LocaleTwinInputFile,
  type LocaleTwinReport,
} from './generateLocaleTwins';
import { createMissingTranslationsDiagnostic } from './diagnostics';
import {
  createInvalidTranslationFileDiagnostic,
  createLargeOutputMultiplierDiagnostic,
  createMissingTranslationFilesDiagnostic,
  createUnfilledPlaceholdersDiagnostic,
  createUnreadablePreviousManifestDiagnostic,
} from './buildDiagnostics';

/** Build report file written next to the twin manifest. */
export const LOCALE_TWIN_REPORT_FILE = 'gt-locale-twins-report.json';

/**
 * Share of the JS output in twinned files above which the build warns that
 * the output multiplier is large (most of the JS is copied per locale).
 */
export const LARGE_TWINNED_SHARE = 0.5;

/** Contents of {@link LOCALE_TWIN_REPORT_FILE}. */
export type LocaleTwinBuildReport = LocaleTwinReport & {
  defaultLocale: string;
  locales: string[];
};

export type WriteLocaleTwinsInput = {
  /** Absolute client output directory. */
  outDir: string;
  /** Emitted JS chunks, keyed by outDir-relative POSIX file name. */
  files: Record<string, LocaleTwinInputFile>;
  /** Other emitted files (assets) and their text, checked for placeholders. */
  assets: Record<string, string>;
  /** Entry chunk file names. */
  entries: string[];
  defaultLocale: string;
  locales: string[];
  /** Absolute translation file path per locale (`files.gt.output`), if configured. */
  translationFile: ((locale: string) => string) | undefined;
  missingTranslations: 'warn' | 'error';
  /** Whether the default vendor chunk was configured (for the multiplier hint). */
  vendorChunk: boolean;
  warn(message: string): void;
};

export type WriteLocaleTwinsResult = {
  manifest: LocaleTwinManifest;
  report: LocaleTwinBuildReport;
};

/**
 * Generates locale twins for a written client build and writes the twins and
 * the manifest ({@link LOCALE_TWIN_MANIFEST_FILE}) into `outDir`. Twins from
 * a previous run that were not regenerated are deleted. Logs warnings for
 * missing translations and a large output multiplier, and throws a
 * diagnostic error when the build must fail. Returns the manifest and the
 * build report (written by {@link writeLocaleTwinReport}).
 */
export function writeLocaleTwins(
  input: WriteLocaleTwinsInput
): WriteLocaleTwinsResult {
  const translations = readTranslations(input);
  const result = generateLocaleTwins({
    files: input.files,
    entries: input.entries,
    defaultLocale: input.defaultLocale,
    locales: input.locales,
    translations,
    missingTranslations: input.missingTranslations,
    previousManifest: readPreviousManifest(input),
  });
  assertNoUnfilledPlaceholders(input, result.manifest);

  for (const [fileName, code] of Object.entries(result.files)) {
    const filePath = path.join(input.outDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, code);
  }
  for (const fileName of result.deletions) {
    fs.rmSync(path.join(input.outDir, fileName), { force: true });
  }
  fs.writeFileSync(
    path.join(input.outDir, LOCALE_TWIN_MANIFEST_FILE),
    `${JSON.stringify(result.manifest, null, 2)}\n`
  );

  const { report } = result;
  if (Object.keys(report.missingTranslations).length > 0) {
    input.warn(
      createMissingTranslationsDiagnostic(report.missingTranslations, 'Warning')
    );
  }
  const totalBytes = report.sharedBytes + report.twinnedBytes;
  if (
    result.manifest.locales.length > 1 &&
    totalBytes > 0 &&
    report.twinnedBytes / totalBytes > LARGE_TWINNED_SHARE
  ) {
    input.warn(
      createLargeOutputMultiplierDiagnostic({
        outputMultiplier: report.outputMultiplier,
        twinnedShare: report.twinnedBytes / totalBytes,
        vendorChunk: input.vendorChunk,
      })
    );
  }

  return {
    manifest: result.manifest,
    report: {
      defaultLocale: result.manifest.defaultLocale,
      locales: result.manifest.locales,
      ...report,
    },
  };
}

/**
 * Writes the build report ({@link LOCALE_TWIN_REPORT_FILE}) into `outDir`.
 * Separate from {@link writeLocaleTwins} so later post-build steps (e.g. the
 * SPA document rewrite) can add to the report first.
 */
export function writeLocaleTwinReport(
  outDir: string,
  report: LocaleTwinBuildReport
): string {
  const reportPath = path.join(outDir, LOCALE_TWIN_REPORT_FILE);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

/**
 * Reads `[locale].json` for every non-default locale. The default locale's
 * table comes from the placeholders, so it needs no file. Missing files are
 * reported once; their locales fall back to the source text.
 */
function readTranslations(
  input: WriteLocaleTwinsInput
): Record<string, LocaleTwinEntries | undefined> {
  const translations: Record<string, LocaleTwinEntries | undefined> = {};
  const missingFiles: string[] = [];
  for (const locale of input.locales) {
    if (locale === input.defaultLocale) continue;
    if (!input.translationFile) continue;
    const filePath = input.translationFile(locale);
    let text: string;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      missingFiles.push(filePath);
      continue;
    }
    try {
      translations[locale] = JSON.parse(text) as LocaleTwinEntries;
    } catch (error) {
      throw new Error(createInvalidTranslationFileDiagnostic(filePath, error));
    }
  }
  const translatedLocales = input.locales.filter(
    (locale) => locale !== input.defaultLocale
  );
  if (
    translatedLocales.length > 0 &&
    (!input.translationFile || missingFiles.length > 0)
  ) {
    input.warn(
      createMissingTranslationFilesDiagnostic(
        input.translationFile ? missingFiles : undefined
      )
    );
  }
  return translations;
}

function readPreviousManifest(
  input: WriteLocaleTwinsInput
): LocaleTwinManifest | undefined {
  const manifestPath = path.join(input.outDir, LOCALE_TWIN_MANIFEST_FILE);
  let text: string;
  try {
    text = fs.readFileSync(manifestPath, 'utf8');
  } catch {
    return undefined;
  }
  try {
    return parseLocaleTwinManifest(text);
  } catch (error) {
    input.warn(createUnreadablePreviousManifestDiagnostic(manifestPath, error));
    return undefined;
  }
}

/**
 * Every emitted file other than an original twinned file is served as built,
 * so none of them may contain an unfilled placeholder. Source maps are
 * skipped: they are not executed.
 */
function assertNoUnfilledPlaceholders(
  input: WriteLocaleTwinsInput,
  manifest: LocaleTwinManifest
): void {
  const twinned = new Set(manifest.twinned);
  const outputs = [
    ...Object.entries(input.files).map(
      ([fileName, file]) => [fileName, file.code] as const
    ),
    ...Object.entries(input.assets),
  ];
  const unfilled = outputs
    .filter(([fileName]) => !twinned.has(fileName))
    .filter(([fileName]) => !fileName.endsWith('.map'))
    .filter(([, code]) => findLocaleTwinPlaceholders(code).length > 0)
    .map(([fileName]) => fileName)
    .sort();
  if (unfilled.length > 0) {
    throw new Error(createUnfilledPlaceholdersDiagnostic(unfilled));
  }
}
