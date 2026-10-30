import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LOCALE_TWIN_BOOTSTRAP_SCRIPT } from 'gt-i18n/internal/locale-twins';
import type { CustomMapping } from 'generaltranslation/types';
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
import { rewriteLocaleTwinDocument } from './spaDocument';
import type { UnattributedEntryLocation } from '../utils/locale-twins/unattributedEntries';
import {
  createInvalidTranslationFileDiagnostic,
  createLargeOutputMultiplierDiagnostic,
  createMissingTranslationFilesDiagnostic,
  createUnfilledPlaceholdersDiagnostic,
  createUnreadablePreviousManifestDiagnostic,
} from './buildDiagnostics';

/** Build report file name. */
export const LOCALE_TWIN_REPORT_FILE = 'gt-locale-twins-report.json';

/**
 * Directory of the build report, relative to the Vite root. It is kept out of
 * the client outDir, which static hosts serve publicly.
 */
export const LOCALE_TWIN_REPORT_DIR = 'node_modules/.cache/gt';

/** External bootstrap: `<prefix>.<content hash>.js`, next to the entry chunk. */
export const LOCALE_TWIN_BOOTSTRAP_FILE_PREFIX = 'gt-locale-twins-bootstrap';

/**
 * Share of the JS output in twinned files above which the build warns that
 * the output multiplier is large (most of the JS is copied per locale).
 */
export const LARGE_TWINNED_SHARE = 0.5;

/** How the built SPA documents select their locale's twins. */
export type LocaleTwinSpaReport = {
  bootstrap: 'inline' | 'external';
  /** outDir-relative HTML files that were rewritten. */
  documents: string[];
  /** CSP source for the inline bootstrap (`script-src 'sha256-…'`). */
  cspHash?: string;
  /** outDir-relative external bootstrap file. */
  bootstrapFile?: string;
};

/** Contents of {@link LOCALE_TWIN_REPORT_FILE}. */
export type LocaleTwinBuildReport = LocaleTwinReport & {
  defaultLocale: string;
  locales: string[];
  /**
   * Entries that keep their source text in client code (they render in the
   * source locale): file relative to the Vite root, 1-based line and column.
   */
  unattributed: UnattributedEntryLocation[];
  /** Present when the build has an HTML document that loads twins. */
  spa?: LocaleTwinSpaReport;
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
  /** Unattributed entries of the client build, for the report. */
  unattributed?: UnattributedEntryLocation[];
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
      unattributed: input.unattributed ?? [],
    },
  };
}

/**
 * Writes the build report ({@link LOCALE_TWIN_REPORT_FILE}) into
 * {@link LOCALE_TWIN_REPORT_DIR} under the Vite `root` (not the public
 * outDir: it lists the build's files and missing translations). Separate from
 * {@link writeLocaleTwins} so later post-build steps (e.g. the SPA document
 * rewrite) can add to the report first. Returns the report path.
 */
export function writeLocaleTwinReport(
  root: string,
  report: LocaleTwinBuildReport
): string {
  const reportPath = path.join(
    root,
    LOCALE_TWIN_REPORT_DIR,
    LOCALE_TWIN_REPORT_FILE
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

export type WriteLocaleTwinSpaDocumentsInput = {
  /** Absolute client output directory. */
  outDir: string;
  /** Emitted HTML documents (outDir-relative name → text). */
  documents: Record<string, string>;
  manifest: LocaleTwinManifest;
  bootstrap: 'inline' | 'external';
  localeCookieName: string;
  enableI18nCookieName: string;
  /** `gt.config.json` `customMapping`, for the bootstrap's locale matching. */
  customMapping?: CustomMapping;
};

/**
 * Rewrites every built HTML document that loads twinned files so the browser
 * picks its locale's twins (see {@link rewriteLocaleTwinDocument}), writes
 * the external bootstrap when requested, and returns the report section.
 * Returns `undefined` when no document loads twinned files.
 */
export function writeLocaleTwinSpaDocuments(
  input: WriteLocaleTwinSpaDocumentsInput
): LocaleTwinSpaReport | undefined {
  const external = input.bootstrap === 'external';
  const bootstrapHash = createHash('sha256').update(
    LOCALE_TWIN_BOOTSTRAP_SCRIPT
  );
  const externalBootstrap = external
    ? {
        fileName: `${LOCALE_TWIN_BOOTSTRAP_FILE_PREFIX}.${bootstrapHash.copy().digest('hex').slice(0, 8)}.js`,
      }
    : undefined;

  const documents: string[] = [];
  const bootstrapFiles = new Set<string>();
  for (const [fileName, html] of Object.entries(input.documents).sort()) {
    const result = rewriteLocaleTwinDocument({
      html,
      manifest: input.manifest,
      localeCookieName: input.localeCookieName,
      enableI18nCookieName: input.enableI18nCookieName,
      customMapping: input.customMapping,
      externalBootstrap,
    });
    if (!result) continue;
    fs.writeFileSync(path.join(input.outDir, fileName), result.html);
    documents.push(fileName);
    if (result.bootstrapFile) bootstrapFiles.add(result.bootstrapFile);
  }
  if (documents.length === 0) return undefined;

  for (const fileName of bootstrapFiles) {
    const filePath = path.join(input.outDir, fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, LOCALE_TWIN_BOOTSTRAP_SCRIPT);
  }
  return external
    ? {
        bootstrap: 'external',
        documents,
        bootstrapFile: [...bootstrapFiles][0],
      }
    : {
        bootstrap: 'inline',
        documents,
        cspHash: `sha256-${bootstrapHash.digest('base64')}`,
      };
}

/**
 * Reads `[locale].json` for every non-default locale. The default locale's
 * content comes from the placeholders, so it needs no file. Missing files are
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
 * No file a visitor can be served may contain an unfilled placeholder:
 * shared JS files and other assets are served as built, so they are checked.
 * Original twinned JS files are the exception: they keep their unfilled
 * placeholders (the next build reads them, which keeps twin generation
 * idempotent), and no served document references them (SPA documents and
 * the TanStack Start asset transform point at twins), so they may be left
 * out of a deploy. Source maps are skipped: they are not executed.
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
