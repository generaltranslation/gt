/**
 * Gets the list of properties for using a locale selector.
 * @param locales an optional list of locales to use for the drop down. These locales must be a subset of the locales provided by the `<GTProvider>` context. When not provided, the list of locales from the `<GTProvider>` context is used.
 * @returns {object} The locale, locales, and setLocale function.
 */
export default function useLocaleSelector(locales?: string[]): {
    locale: string;
    locales: string[];
    setLocale: (locale: string) => void;
};
//# sourceMappingURL=useLocaleSelector.d.ts.map