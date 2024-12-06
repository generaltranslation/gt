import { getLocaleProperties, isValidLocale, standardizeLocale } from "generaltranslation";

const supportedLocales = {
    "en": {
        "en-US": true,
        "en-GB": true,
        "en-CA": true,
        "en-AU": true,
        "en-NZ": true,
    }
} as {
    [language: string]: {
        [locale: string]: true
    }
};

export function getSupportedLocale(locale: string) {
    
    if (!isValidLocale(locale)) return null;
    locale = standardizeLocale(locale);

    if (supportedLocales[locale]) return locale;
    
    const {
        languageCode, minimizedCode
    } = getLocaleProperties(locale);
    
    if (supportedLocales[languageCode]) {
        const exactSupportedLocales = supportedLocales[languageCode];
        if (exactSupportedLocales[locale]) return locale;
        if (exactSupportedLocales[minimizedCode]) return minimizedCode;
        return languageCode;
    }

    return null;
}