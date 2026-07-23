import { getI18nConfig } from 'gt-i18n/internal';
import { createInvalidRequestLocaleWarning } from '../errors/request';

function determineSupportedLocale(locale: unknown): string | undefined {
  if (typeof locale !== 'string' || locale.length === 0) return undefined;
  return getI18nConfig().determineSupportedLocale(locale);
}

function warnInvalidLocale(locale: string, defaultLocale: string) {
  if (
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING === 'true'
  ) {
    return;
  }

  console.warn(createInvalidRequestLocaleWarning(locale, defaultLocale));
}

export function resolveLocaleOrDefault(locale: unknown): string {
  const i18nConfig = getI18nConfig();
  const defaultLocale = i18nConfig.getDefaultLocale();
  const supportedLocale =
    typeof locale === 'string' && locale.length > 0
      ? i18nConfig.determineSupportedLocale(locale)
      : undefined;

  if (supportedLocale) return i18nConfig.resolveAliasLocale(supportedLocale);

  if (typeof locale === 'string' && locale.length > 0) {
    warnInvalidLocale(locale, defaultLocale);
  }

  return i18nConfig.resolveAliasLocale(defaultLocale);
}

/**
 * Checks whether a locale is valid and supported by the current gt-next config.
 *
 * Use this when route params or other request inputs should be rejected instead
 * of falling back to the default locale.
 *
 * @param locale - The locale candidate to validate.
 * @returns True when the locale resolves to one of the configured locales.
 */
export function isLocaleSupported(locale: unknown): locale is string {
  return determineSupportedLocale(locale) !== undefined;
}
