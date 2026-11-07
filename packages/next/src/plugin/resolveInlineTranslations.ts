import fs from 'fs';
import path from 'path';
import type { GTOutputFileConfig } from 'generaltranslation/types';

const LOCALE_PLACEHOLDER = '[locale]';

/**
 * Translations resolved for the SWC plugin, which receives them as plugin
 * options. Mirrors @generaltranslation/compiler's loadInlineTranslations().
 */
export type ResolvedInlineTranslations = {
  locales: string[];
  translations: Record<string, Record<string, unknown>>;
};

/**
 * Read the translations to embed for `files.gt.inlineTranslations.locales`
 * from the translation files at `files.gt.output`. Locales without a
 * translations file are dropped. Returns undefined outside production builds,
 * matching the babel compiler.
 */
export function resolveInlineTranslations(
  gtFiles: Pick<GTOutputFileConfig, 'output' | 'inlineTranslations'> | undefined
): ResolvedInlineTranslations | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const requestedLocales = gtFiles?.inlineTranslations?.locales ?? [];
  if (requestedLocales.length === 0) return undefined;

  const translations: Record<string, Record<string, unknown>> = {};
  for (const locale of requestedLocales) {
    const localeTranslations = readLocaleFile(gtFiles?.output, locale);
    if (localeTranslations) translations[locale] = localeTranslations;
  }

  const locales = requestedLocales.filter((locale) => locale in translations);
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
