import fs from 'node:fs';
import path from 'node:path';
import type { GTOutputFileConfig } from 'generaltranslation/types';

/**
 * Translations to embed, keyed by locale, then by translation hash.
 */
export type InlineTranslationsTable = Record<string, Record<string, unknown>>;

const LOCALE_PLACEHOLDER = '[locale]';

// Shared across files so each locale file is read once per build. One entry per
// configuration, replaced when the files' modification times change, so a later
// build in the same process (watch mode) picks up edits without keeping old tables.
const tableCache = new Map<
  string,
  { mtimes: string; table: InlineTranslationsTable }
>();

/**
 * Read the translations to embed for `files.gt.inlineTranslations.locales`
 * from the translation files at `files.gt.output`.
 *
 * Locales without a translations file are skipped, so those locales keep
 * loading at runtime.
 */
export function loadInlineTranslations(
  gtFiles: GTOutputFileConfig | undefined
): InlineTranslationsTable | undefined {
  const locales = gtFiles?.inlineTranslations?.locales ?? [];
  const output = gtFiles?.output;
  if (locales.length === 0 || !output) return undefined;

  const cacheKey = JSON.stringify([locales, output]);
  const mtimes = JSON.stringify(
    locales.map((locale) => getLocaleFileMtime(output, locale))
  );
  const cached = tableCache.get(cacheKey);
  if (cached?.mtimes === mtimes) return cached.table;

  const table: InlineTranslationsTable = {};
  for (const { locale, filePath } of resolveInlineTranslationsFiles(gtFiles)) {
    const translations = readTranslationsFile(filePath);
    if (translations) table[locale] = translations;
  }

  if (Object.keys(table).length === 0) {
    tableCache.delete(cacheKey);
    return undefined;
  }
  tableCache.set(cacheKey, { mtimes, table });
  return table;
}

/**
 * Locale files embedded translations are read from, for registering them as
 * build dependencies so watch rebuilds pick up edited translations.
 */
export function getInlineTranslationsFiles(
  gtFiles: GTOutputFileConfig | undefined
): string[] {
  return resolveInlineTranslationsFiles(gtFiles).map(
    ({ filePath }) => filePath
  );
}

/**
 * The `files.gt.output` file of each embedded locale that exists, in
 * `files.gt.inlineTranslations.locales` order. Paths resolve from the working
 * directory.
 */
export function resolveInlineTranslationsFiles(
  gtFiles: GTOutputFileConfig | undefined
): { locale: string; filePath: string }[] {
  const locales = gtFiles?.inlineTranslations?.locales ?? [];
  return locales.flatMap((locale) => {
    const filePath = resolveLocaleFilePath(gtFiles?.output, locale);
    return filePath && fs.existsSync(filePath) ? [{ locale, filePath }] : [];
  });
}

/**
 * A translations file's entries keyed by hash, or undefined when it is not a
 * JSON object.
 */
export function readTranslationsFile(
  filePath: string
): Record<string, unknown> | undefined {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

function resolveLocaleFilePath(
  pathTemplate: string | undefined,
  locale: string
): string | undefined {
  if (!pathTemplate?.includes(LOCALE_PLACEHOLDER)) return undefined;
  return path.resolve(pathTemplate.split(LOCALE_PLACEHOLDER).join(locale));
}

function getLocaleFileMtime(
  pathTemplate: string | undefined,
  locale: string
): number | null {
  const filePath = resolveLocaleFilePath(pathTemplate, locale);
  if (!filePath) return null;
  return fs.statSync(filePath, { throwIfNoEntry: false })?.mtimeMs ?? null;
}

/**
 * Clear cached locale files.
 * Testing only.
 */
export function clearInlineTranslationsCache(): void {
  tableCache.clear();
}
