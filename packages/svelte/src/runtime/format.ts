import { getI18nConfig } from 'gt-i18n/internal';

/**
 * Locales used to format variables in content that renders in `locale`:
 * explicit `locales`, then `locale`, then the default locale. Source content
 * formats in the default locale only.
 */
export function getFormatLocales(
  locale: string,
  localesProp: string[] = []
): string[] {
  const config = getI18nConfig();
  const defaultLocale = config.getDefaultLocale();
  return config.requiresTranslation({ locale })
    ? [...localesProp, locale, defaultLocale]
    : [defaultLocale];
}

/** The GTIntl instance used for formatting. */
export function getFormatter() {
  return getI18nConfig();
}
