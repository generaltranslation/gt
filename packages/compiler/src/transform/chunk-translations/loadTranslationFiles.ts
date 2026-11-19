import fs from 'node:fs';
import path from 'node:path';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

/** Translations keyed by locale, then by hash. */
export type TranslationsTable = Record<string, Record<string, unknown>>;

const LOCALE_PLACEHOLDER = '[locale]';

// Shared across hooks so each locale file is read once per build, and read
// again when its modification time changes (watch mode).
const tableCache = new Map<
  string,
  { mtimes: string; table: TranslationsTable }
>();

/**
 * The translations of each locale whose file at `output` (with `[locale]` in
 * it) exists. Paths resolve from the working directory.
 */
export function loadTranslationFiles(
  output: string,
  locales: readonly string[]
): TranslationsTable {
  const cacheKey = JSON.stringify([locales, output]);
  const mtimes = JSON.stringify(
    locales.map(
      (locale) =>
        fs.statSync(resolveLocaleFilePath(output, locale), {
          throwIfNoEntry: false,
        })?.mtimeMs ?? null
    )
  );
  const cached = tableCache.get(cacheKey);
  if (cached?.mtimes === mtimes) return cached.table;

  const table: TranslationsTable = {};
  for (const { locale, filePath } of resolveTranslationFiles(output, locales)) {
    let translations: Record<string, unknown> | undefined;
    try {
      translations = readTranslationsFile(filePath);
    } catch (error) {
      throw new Error(createTranslationsFileReadError(filePath, error));
    }
    if (translations) table[locale] = translations;
  }
  tableCache.set(cacheKey, { mtimes, table });
  return table;
}

const createTranslationsFileReadError = (filePath: string, error: unknown) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Could not read the translations in ${filePath}`,
    fix: 'Make sure the file contains valid JSON',
    details: formatDiagnosticErrorDetails(error),
  });

/** The file at `output` of each locale that exists, without repeats. */
export function resolveTranslationFiles(
  output: string,
  locales: readonly string[]
): { locale: string; filePath: string }[] {
  return [...new Set(locales)].flatMap((locale) => {
    const filePath = resolveLocaleFilePath(output, locale);
    return fs.existsSync(filePath) ? [{ locale, filePath }] : [];
  });
}

/**
 * A translations file's entries keyed by hash, or undefined when it is not a
 * JSON object.
 */
function readTranslationsFile(
  filePath: string
): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

function resolveLocaleFilePath(pathTemplate: string, locale: string): string {
  return path.resolve(pathTemplate.split(LOCALE_PLACEHOLDER).join(locale));
}
