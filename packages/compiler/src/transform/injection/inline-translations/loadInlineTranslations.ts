import fs from 'node:fs';
import path from 'node:path';
import type { GTInlineTranslationsOptions } from 'generaltranslation/types';

/**
 * Translations to embed, keyed by locale, then by translation hash.
 */
export type InlineTranslationsTable = Record<string, Record<string, unknown>>;

const LOCALE_PLACEHOLDER = '[locale]';

// Shared across files so each locale file is read once per build
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
    : JSON.stringify([options.locales, options.path]);
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

function readLocaleFile(
  pathTemplate: string | undefined,
  locale: string
): Record<string, unknown> | undefined {
  if (!pathTemplate?.includes(LOCALE_PLACEHOLDER)) return undefined;
  const filePath = path.resolve(
    pathTemplate.split(LOCALE_PLACEHOLDER).join(locale)
  );
  if (!fs.existsSync(filePath)) return undefined;
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
