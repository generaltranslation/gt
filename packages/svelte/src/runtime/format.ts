import { getI18nConfig } from 'gt-i18n/internal';

/**
 * Locales used to format variables in content that renders in `locale`:
 * `locale`, then the default locale. Source content formats in the default
 * locale only.
 */
export function getFormatLocales(locale: string): string[] {
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  return config.requiresTranslation({ locale })
    ? [locale, defaultLocale]
    : [defaultLocale];
}
