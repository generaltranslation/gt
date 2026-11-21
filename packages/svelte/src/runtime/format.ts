import { getI18nConfig } from 'gt-i18n/internal';

/**
 * The locale a variable formats in: the locale its content renders in.
 * Source content formats in the default locale.
 */
export function getFormatLocales(locale: string): string[] {
  const config = getI18nConfig();
  if (!config.requiresTranslation({ locale })) {
    return [config.getDefaultLocale()];
  }
  return [locale];
}

/**
 * The locale a plural is selected in. A custom alias reaches Intl as its
 * code, never by name.
 */
export function getPluralLocales(locale: string): string[] {
  return [getI18nConfig().resolveCanonicalLocale(locale)];
}
