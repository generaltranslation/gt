import { getI18nConfig } from 'gt-i18n/internal';

/**
 * The locale a variable formats in: the locale its content renders in.
 * Source content formats in the default locale, or in a locale that reads
 * the default locale's language.
 */
export function getFormatLocales(locale: string): string[] {
  const config = getI18nConfig();
  return [
    config.requiresTranslation({ locale })
      ? locale
      : config.getSourceFormatLocale(locale),
  ];
}
