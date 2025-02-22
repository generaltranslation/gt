/**
 *
 * @param defaultLocale
 * @param locales
 * @param locale
 * @param cookieName
 * @returns locale, and setLocale (will override user's browser preferences unless a locale is explicitly passed)
 */
export default function useDetermineLocale({ locale: _locale, defaultLocale, locales, cookieName, }: {
    defaultLocale: string;
    locales: string[];
    locale?: string;
    cookieName?: string;
}): [string, (locale: string) => void];
//# sourceMappingURL=useDetermineLocale.d.ts.map