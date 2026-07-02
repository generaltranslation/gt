import type { GT } from 'generaltranslation';
import { getI18NConfig } from '../config-dir/getI18NConfig';
import type { I18NConfiguration } from '../config-dir/I18NConfiguration';
import { createInvalidRequestLocaleWarning } from '../errors/createErrors';

function determineSupportedLocale(
  locale: unknown,
  I18NConfig: I18NConfiguration,
  gt: GT
): string | undefined {
  if (typeof locale !== 'string' || locale.length === 0) return undefined;
  return gt.determineLocale([locale], I18NConfig.getLocales());
}

function warnInvalidLocale(locale: string, defaultLocale: string) {
  if (
    process.env._GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING === 'true'
  ) {
    return;
  }

  console.warn(createInvalidRequestLocaleWarning(locale, defaultLocale));
}

export function resolveLocaleOrDefault(
  locale: unknown,
  I18NConfig: I18NConfiguration,
  gt: GT
): string {
  const defaultLocale = I18NConfig.getDefaultLocale();
  const supportedLocale = determineSupportedLocale(locale, I18NConfig, gt);

  if (supportedLocale) return gt.resolveAliasLocale(supportedLocale);

  if (typeof locale === 'string' && locale.length > 0) {
    warnInvalidLocale(locale, defaultLocale);
  }

  return gt.resolveAliasLocale(defaultLocale);
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
  const I18NConfig = getI18NConfig();
  const gt = I18NConfig.getGTClass();

  return determineSupportedLocale(locale, I18NConfig, gt) !== undefined;
}
