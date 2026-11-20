import { getI18nConfig } from 'gt-i18n/internal';

/**
 * The locales a variable formats in: the locale its content renders in, then
 * the default locale, which `Intl` formats in when it has no data for the
 * first. Source content formats in the default locale.
 */
export function getFormatLocales(locale: string): string[] {
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  if (!config.requiresTranslation({ locale })) {
    return [defaultLocale];
  }
  return [locale, defaultLocale];
}
