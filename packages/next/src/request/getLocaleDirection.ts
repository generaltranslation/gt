import getI18NConfig from "../config-dir/getI18NConfig";
import use from "../utils/use";
import { getLocale } from "./getLocale";

/**
 * Retrieves the text direction ('ltr' or 'rtl') for the current or specified locale.
 *
 * If no locale is provided, the direction for the current user's locale is returned.
 *
 * @param {string} [locale] - Optional locale code (e.g., 'ar', 'en-US'). If omitted, uses the current locale.
 * @returns {Promise<'ltr' | 'rtl'>} A promise that resolves to the text direction for the locale: 'rtl' for right-to-left languages, otherwise 'ltr'.
 *
 * @example
 * const dir = await getLocaleDirection(); // e.g., 'ltr'
 * const arabicDir = await getLocaleDirection('ar'); // 'rtl'
 */
export async function getLocaleDirection(locale?: string): Promise<'ltr' | 'rtl'> {
    locale ||= await getLocale();
    const gt = getI18NConfig().getGTClass();
    return gt.getLocaleDirection(locale);
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
export function useLocaleDirection(locale?: string): "ltr" | "rtl" {
    return use(getLocaleDirection(locale))
}