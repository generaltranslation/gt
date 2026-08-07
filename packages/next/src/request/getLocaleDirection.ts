import { getI18nConfig } from 'gt-i18n/internal';
import { getLocale, useLocale } from './getLocale';

/**
 * Retrieves the text direction ('ltr' or 'rtl') for the current or specified locale.
 *
 * If no locale is provided, the direction for the current user's locale is returned asynchronously.
 *
 * @param locale Optional locale code (e.g., 'ar', 'en-US'). If omitted, uses the current locale.
 * @returns If locale is omitted: Promise<'ltr' | 'rtl'>.
 *          If locale is provided: 'ltr' | 'rtl' directly.
 *
 * @example
 * const dir = await getLocaleDirection(); // Promise<'ltr' | 'rtl'>
 * const arabicDir = getLocaleDirection('ar'); // 'rtl'
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl';
export function getLocaleDirection(): Promise<'ltr' | 'rtl'>;
// Implementation
export function getLocaleDirection(locale?: string) {
  const i18nConfig = getI18nConfig();
  if (typeof locale === 'string') {
    // Synchronous result when locale is given
    return i18nConfig.getLocaleDirection(locale) as 'ltr' | 'rtl';
  }
  // Asynchronous result when locale is not given
  return getLocale().then((resolvedLocale) =>
    i18nConfig.getLocaleDirection(resolvedLocale)
  ) as Promise<'ltr' | 'rtl'>;
}

/**
 * Retrieves the text direction ('ltr' or 'rtl') for the current or specified locale from the `<GTProvider>` context.
 *
 * If no locale is provided, the direction for the current user's locale is returned.
 *
 * @param {string} [locale] - Optional locale code (e.g., 'ar', 'en-US'). If omitted, uses the current locale from context.
 * @returns {'ltr' | 'rtl'} The text direction for the locale: 'rtl' for right-to-left languages, otherwise 'ltr'.
 *
 * @example
 * const dir = useLocaleDirection(); // e.g., 'ltr'
 * const arabicDir = useLocaleDirection('ar'); // 'rtl'
 */
export function useLocaleDirection(locale?: string): 'ltr' | 'rtl' {
  locale = locale || useLocale();
  return getI18nConfig().getLocaleDirection(locale);
}
