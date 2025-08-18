import useGTContext from "../provider/GTContext";

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
    const { gt } = useGTContext(
        'useLocaleDirection(): Unable to access configured GT class instance outside of a <GTProvider>'
    );
    return gt.getLocaleDirection(locale);
}