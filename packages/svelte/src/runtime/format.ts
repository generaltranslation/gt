import { getI18nConfig } from 'gt-i18n/internal';

/**
 * The locales a variable formats in: the `locales` prop as it is given, or
 * the locale its content renders in. Source content formats in the default
 * locale.
 */
export function getFormatLocales(
  locale: string,
  localesProp: string[] = []
): string[] {
  const config = getI18nConfig();
  if (!config.requiresTranslation({ locale })) {
    return [config.getDefaultLocale()];
  }
  return localesProp.length ? localesProp : [locale];
}
