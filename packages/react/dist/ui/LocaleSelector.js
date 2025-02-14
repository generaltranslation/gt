import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import useSetLocale from '../hooks/useSetLocale';
import useLocale from '../hooks/useLocale';
import useLocales from '../hooks/useLocales';
import { getLocaleProperties } from 'generaltranslation';
/**
 * Capitalizes the first letter of a language name if applicable.
 * For languages that do not use capitalization, it returns the name unchanged.
 * @param {string} language - The name of the language.
 * @returns {string} The language name with the first letter capitalized if applicable.
 */
function capitalizeLanguageName(language) {
    if (!language)
        return '';
    return (language.charAt(0).toUpperCase() +
        (language.length > 1 ? language.slice(1) : ''));
}
/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - The list of supported locales. By default this is the user's list of supported locales from the `<GTProvider>` context.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({ locales = useLocales().sort(), }) {
    // Retrieve the locale, locales, and setLocale function
    const locale = useLocale();
    const setLocale = useSetLocale();
    // If no locales are returned, just render nothing or handle gracefully
    if (!locales || locales.length === 0 || !setLocale) {
        return null;
    }
    return (_jsxs("select", { 
        // Fallback to an empty string if currentLocale is undefined
        value: locale || '', onChange: (e) => setLocale(e.target.value), children: [!locale && _jsx("option", { value: '' }), locales.map((locale) => (_jsx("option", { value: locale, suppressHydrationWarning: true, children: capitalizeLanguageName(getLocaleProperties(locale).nativeNameWithRegionCode) }, locale)))] }));
}
