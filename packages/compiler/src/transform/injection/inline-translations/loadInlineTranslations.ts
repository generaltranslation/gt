import fs from 'node:fs';
import path from 'node:path';
import type { GTInlineTranslationsOptions } from 'generaltranslation/types';

/**
 * Translations to embed, keyed by locale, then by translation hash.
 */
export type InlineTranslationsTable = NonNullable<
  GTInlineTranslationsOptions['translations']
>;

const LOCALE_PLACEHOLDER = '[locale]';

// Shared across files so each locale file is read once per build. Keyed by the
// files' modification times so a later build in the same process (watch mode,
// repeated builds) picks up edited translations.
const tableCache = new Map<string, InlineTranslationsTable>();

/**
 * Resolve the translations to embed from the plugin options.
 *
 * Explicit `translations` win over files read from `path`. Locales without
 * translations are skipped, so those locales keep loading at runtime.
 */
export function loadInlineTranslations(
  options: GTInlineTranslationsOptions | undefined
): InlineTranslationsTable | undefined {
  if (!options || options.locales.length === 0) return undefined;

  const cacheKey = options.translations
    ? undefined
    : JSON.stringify([
        options.locales,
        options.path,
        options.locales.map((locale) =>
          getLocaleFileMtime(options.path, locale)
        ),
      ]);
  if (cacheKey && tableCache.has(cacheKey)) return tableCache.get(cacheKey);

  const table: InlineTranslationsTable = {};
  for (const locale of options.locales) {
    const translations =
      options.translations?.[locale] ?? readLocaleFile(options.path, locale);
    if (translations) table[locale] = translations;
  }

  const result = Object.keys(table).length > 0 ? table : undefined;
  if (cacheKey && result) tableCache.set(cacheKey, result);
  return result;
}

/**
 * Locale files embedded translations are read from, for registering them as
 * build dependencies so watch rebuilds pick up edited translations.
 */
export function getInlineTranslationsFiles(
  options: GTInlineTranslationsOptions | undefined
): string[] {
  if (!options) return [];
  return options.locales.flatMap((locale) => {
    // Explicit translations win, so only file-backed locales are dependencies
    if (options.translations?.[locale]) return [];
    const filePath = resolveLocaleFilePath(options.path, locale);
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
