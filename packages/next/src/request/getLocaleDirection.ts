import getI18NConfig from '../config-dir/getI18NConfig';
import use from '../utils/use';
import { getLocale } from './getLocale';

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
export function getLocaleDirection(): Promise<'ltr' | 'rtl'>;
export function getLocaleDirection(locale: string): 'ltr' | 'rtl';
export function getLocaleDirection(
  locale?: string
): Promise<'ltr' | 'rtl'> | 'ltr' | 'rtl' {
  if (locale) {
    const gt = getI18NConfig().getGTClass();
    return gt.getLocaleDirection(locale);
  }
  return (async () => {
    const resolvedLocale = await getLocale();
    const gt = getI18NConfig().getGTClass();
    return gt.getLocaleDirection(resolvedLocale);
  })();
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
  return use(getLocaleDirection(locale));
}
