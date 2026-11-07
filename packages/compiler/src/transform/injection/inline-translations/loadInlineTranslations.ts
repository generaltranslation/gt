import fs from 'node:fs';
import path from 'node:path';
import type { GTOutputFileConfig } from 'generaltranslation/types';

/**
 * Translations to embed, keyed by locale, then by translation hash.
 */
export type InlineTranslationsTable = Record<string, Record<string, unknown>>;

const LOCALE_PLACEHOLDER = '[locale]';

// Shared across files so each locale file is read once per build. Keyed by the
// files' modification times so a later build in the same process (watch mode,
// repeated builds) picks up edited translations.
const tableCache = new Map<string, InlineTranslationsTable>();

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

  const cacheKey = JSON.stringify([
    locales,
    output,
    locales.map((locale) => getLocaleFileMtime(output, locale)),
  ]);
  const cached = tableCache.get(cacheKey);
  if (cached) return cached;

  const table: InlineTranslationsTable = {};
  for (const locale of locales) {
    const translations = readLocaleFile(output, locale);
    if (translations) table[locale] = translations;
  }

  if (Object.keys(table).length === 0) return undefined;
  tableCache.set(cacheKey, table);
  return table;
}

/**
 * Locale files embedded translations are read from, for registering them as
 * build dependencies so watch rebuilds pick up edited translations.
 */
export function getInlineTranslationsFiles(
  gtFiles: GTOutputFileConfig | undefined
): string[] {
  const locales = gtFiles?.inlineTranslations?.locales ?? [];
  return locales.flatMap((locale) => {
    const filePath = resolveLocaleFilePath(gtFiles?.output, locale);
    return filePath && fs.existsSync(filePath) ? [filePath] : [];
  });
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

function readLocaleFile(
  pathTemplate: string | undefined,
  locale: string
): Record<string, unknown> | undefined {
  const filePath = resolveLocaleFilePath(pathTemplate, locale);
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

/**
 * Clear cached locale files.
 * Testing only.
 */
export function clearInlineTranslationsCache(): void {
  tableCache.clear();
}
