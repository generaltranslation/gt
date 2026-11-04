import fs from 'fs';
import path from 'path';
import type { GTInlineTranslationsOptions } from 'generaltranslation/types';

const LOCALE_PLACEHOLDER = '[locale]';

/**
 * Translations resolved for the SWC plugin, which cannot reliably read files
 * from its wasm sandbox. Mirrors @generaltranslation/compiler's
 * loadInlineTranslations().
 */
export type ResolvedInlineTranslations = {
  locales: string[];
  translations: Record<string, Record<string, unknown>>;
};

/**
 * Resolve inline translations for the SWC plugin. Explicit `translations`
 * win over files read from `path`. Locales without translations are dropped.
 * Returns undefined outside production builds, matching the babel compiler.
 */
export function resolveInlineTranslations(
  options: GTInlineTranslationsOptions | undefined
): ResolvedInlineTranslations | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  if (!options || options.locales.length === 0) return undefined;

  const translations: Record<string, Record<string, unknown>> = {};
  for (const locale of options.locales) {
    const localeTranslations =
      options.translations?.[locale] ?? readLocaleFile(options.path, locale);
    if (localeTranslations) translations[locale] = localeTranslations;
  }

  const locales = options.locales.filter((locale) => locale in translations);
  if (locales.length === 0) return undefined;
  return { locales, translations };
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
