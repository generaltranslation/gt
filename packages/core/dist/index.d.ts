import { Content, JsxChildren, JsxTranslationResult, ContentTranslationResult, TranslationError, IcuTranslationResult } from './types';
/**
 * Type representing the constructor parameters for the GT class.
 */
type GTConstructorParams = {
    apiKey?: string;
    devApiKey?: string;
    sourceLocale?: string;
    projectId?: string;
    baseUrl?: string;
};
/**
 * GT is the core driver for the General Translation library.
 */
declare class GT {
    apiKey: string;
    devApiKey: string;
    sourceLocale: string;
    projectId: string;
    baseUrl: string;
    /**
     * Constructs an instance of the GT class.
     *
     * @param {GTConstructorParams} [params] - The parameters for initializing the GT instance.
     * @param {string} [params.apiKey=''] - The API key for accessing the translation service.
     * @param {string} [params.sourceLocale='en-US'] - The default locale for translations.
     * @param {string} [params.projectId=''] - The project ID for the translation service.
     * @param {string} [params.baseUrl='https://api.gtx.dev'] - The base URL for the translation service.
     */
    constructor({ apiKey, devApiKey, sourceLocale, projectId, baseUrl, }?: GTConstructorParams);
    /**
     * Translates a string or an array of strings/variables into a target locale.
     * If `metadata.save` is provided, the translation is cached for use in a public project.
     *
     * @param {Content} source - The string or array of strings/variables to be translated.
     * @param {string} locale - The target locale code (e.g., 'en-US', 'fr') for the translation.
     * @param {{ context?: string, [key: string]: any }} [metadata] - Additional metadata for the translation request.
     * @param {string} [metadata.context] - Contextual information to assist with the translation.
     *
     * @returns {Promise<ContentTranslationResult | TranslationError>} A promise that resolves to the translated content, or an error if the translation fails.
     */
    translate(source: Content, locale: string, metadata?: {
        context?: string;
        id?: string;
        publish?: boolean;
        fast?: boolean;
        sourceLocale?: string;
        [key: string]: any;
    }): Promise<ContentTranslationResult | TranslationError>;
    /**
     * Translates JSX elements into a given locale.
     *
     * @param {Object} params - The parameters for the translation.
     * @param {JsxChildren} params.source - The JSX children content to be translated.
     * @param {string} params.locale - The target locale for the translation.
     * @param {Object} params.metadata - Additional metadata for the translation process.
     *
     * @returns {Promise<JsxTranslationResult | TranslationError>} - A promise that resolves to the translated content.
     */
    translateJsx(source: JsxChildren, locale: string, metadata?: {
        context?: string;
        id?: string;
        publish?: boolean;
        fast?: boolean;
        sourceLocale?: string;
        [key: string]: any;
    }): Promise<JsxTranslationResult | TranslationError>;
    /**
     * Translates an ICU message into a given locale.
     * If `metadata.save` is provided, the translation is cached for use in a public project.
     *
     * @param {string} source - The ICU message to be translated.
     * @param {string} locale - The target locale code (e.g., 'en-US', 'fr') for the translation.
     * @param {{ context?: string, [key: string]: any }} [metadata] - Additional metadata for the translation request.
     * @param {string} [metadata.context] - Contextual information to assist with the translation.
     *
     * @returns {Promise<ContentTranslationResult | TranslationError>} A promise that resolves to the translated content, or an error if the translation fails.
     */
    translateIcu(source: string, locale: string, metadata?: {
        context?: string;
        id?: string;
        publish?: boolean;
        fast?: boolean;
        sourceLocale?: string;
        [key: string]: any;
    }): Promise<IcuTranslationResult | TranslationError>;
}
/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 *
 * @param {string} locale - The locale code to check.
 * @returns {string} - 'rtl' if the locale is right-to-left, otherwise 'ltr'.
 */
export declare function getLocaleDirection(locale: string): 'ltr' | 'rtl';
/**
 * Retrieves the display name of locale code using Intl.DisplayNames.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @param {string} [defaultLocale = 'en-US'] - The locale for display names.
 * @returns {string} The display name corresponding to the code.
 */
export declare function getLocaleName(locale: string, defaultLocale?: string): string;
/**
 * Generates linguistic details for a given locale code.
 *
 * This function returns information about the locale,
 * script, and region of a given language code both in a standard form and in a maximized form (with likely script and region).
 * The function provides these names in both your default language and native forms, and an associated emoji.
 *
 * @param {string} locale - The locale code to get properties for (e.g., "de-AT").
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale code for display names.
 * @returns {LocaleProperties} - An object containing detailed information about the locale.
 *
 * @property {string} code - The full locale code, e.g., "de-AT".
 * @property {string} name - Language name in the default display language, e.g., "Austrian German".
 * @property {string} nativeName - Language name in the locale's native language, e.g., "Österreichisches Deutsch".
 * @property {string} languageCode - The base language code, e.g., "de".
 * @property {string} languageName - The language name in the default display language, e.g., "German".
 * @property {string} nativeLanguageName - The language name in the native language, e.g., "Deutsch".
 * @property {string} nameWithRegionCode - Language name with region in the default language, e.g., "German (AT)".
 * @property {string} nativeNameWithRegionCode - Language name with region in the native language, e.g., "Deutsch (AT)".
 * @property {string} regionCode - The region code from maximization, e.g., "AT".
 * @property {string} regionName - The region name in the default display language, e.g., "Austria".
 * @property {string} nativeRegionName - The region name in the native language, e.g., "Österreich".
 * @property {string} scriptCode - The script code from maximization, e.g., "Latn".
 * @property {string} scriptName - The script name in the default display language, e.g., "Latin".
 * @property {string} nativeScriptName - The script name in the native language, e.g., "Lateinisch".
 * @property {string} maximizedCode - The maximized locale code, e.g., "de-Latn-AT".
 * @property {string} maximizedName - Maximized locale name with likely script in the default language, e.g., "Austrian German (Latin)".
 * @property {string} nativeMaximizedName - Maximized locale name in the native language, e.g., "Österreichisches Deutsch (Lateinisch)".
 * @property {string} minimizedCode - Minimized locale code, e.g., "de-AT" (or "de" for "de-DE").
 * @property {string} minimizedName - Minimized language name in the default language, e.g., "Austrian German".
 * @property {string} nativeMinimizedName - Minimized language name in the native language, e.g., "Österreichisches Deutsch".
 * @property {string} emoji - The emoji associated with the locale's region, if applicable.
 */
export declare function getLocaleProperties(locale: string, defaultLocale?: string): {
    code: string;
    name: string;
    nativeName: string;
    languageCode: string;
    languageName: string;
    nativeLanguageName: string;
    nameWithRegionCode: string;
    nativeNameWithRegionCode: string;
    regionCode: string;
    regionName: string;
    nativeRegionName: string;
    scriptCode: string;
    scriptName: string;
    nativeScriptName: string;
    maximizedCode: string;
    maximizedName: string;
    nativeMaximizedName: string;
    minimizedCode: string;
    minimizedName: string;
    nativeMinimizedName: string;
    emoji: string;
};
/**
 * Retrieves an emoji based on a given locale code, taking into account region, language, and specific exceptions.
 * This function uses the locale's region (if present) to select an emoji or falls back on default emojis for certain languages.
 *
 * @param code - A string representing the locale code (e.g., 'en-US', 'fr-CA').
 * @param custom - An optional custom mapping of locale codes to emojis.
 * @returns The emoji representing the locale or its region, or a default emoji if no specific match is found.
 */
export declare function getLocaleEmoji(locale: string, custom?: Record<string, string>): string;
/**
 * Checks if a given BCP 47 locale code is valid.
 * @param {string} locale - The BCP 47 locale code to validate.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 */
export declare function isValidLocale(locale: string): boolean;
/**
 * Standardizes a BCP 47 locale code to ensure correct formatting.
 * @param {string} locale - The BCP 47 locale code to standardize.
 * @returns {string} The standardized BCP 47 locale code or an empty string if it is an invalid code.
 */
export declare function standardizeLocale(locale: string): string;
/**
 * Checks if multiple BCP 47 locale codes represent the same dialect.
 *
 * For example, `"en-US"` and `"en-GB"` are the same language, but different dialects.
 * `isSameDialect("en-US", "en-GB")` would return `false`.
 *
 * For checking if two locale codes represent the same language, see `isSameLanguage()`.
 *
 * Note that `isSameDialect("en", "en-US")` and `isSameDialect("en", "en-GB")` would both return true.
 *
 * @param {string[]} locales - The BCP 47 locale codes to compare.
 * @returns {boolean} True if all BCP 47 codes represent the same dialect, false otherwise.
 */
export declare function isSameDialect(...locales: (string | string[])[]): boolean;
/**
 * Checks if multiple BCP 47 locale codes represent the same language.
 *
 * For example, `"en-US"` and `"en-GB"` are the same language, English.
 * `isSameDialect("en-US", "en-GB")` would return `true`.
 *
 * For checking if two codes represent the exact same dialect, see `isSameDialect()`.
 *
 * @param {string[]} locales - The BCP 47 locale codes to compare.
 * @returns {boolean} True if all BCP 47 codes represent the same locale, false otherwise.
 */
export declare function isSameLanguage(...locales: (string | string[])[]): boolean;
/**
 * Formats a number according to the specified locales and options.
 * @param {Object} params - The parameters for the number formatting.
 * @param {number} params.value - The number to format.
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for number formatting.
 * @returns {string} The formatted number.
 */
export declare function formatNum(params: {
    value: number;
    locales?: string | string[];
    options?: Intl.NumberFormatOptions;
}): string;
/**
 * Formats a date according to the specified languages and options.
 * @param {Object} params - The parameters for the date formatting.
 * @param {Date} params.value - The date to format.
 * @param {string | string[]} [params.locales=['en-US']] - The languages to use for formatting.
 * @param {Intl.DateTimeFormatOptions} [params.options={}] - Additional options for date formatting.
 * @returns {string} The formatted date.
 */
export declare function formatDateTime(params: {
    value: Date;
    locales?: string | string[];
    options?: Intl.DateTimeFormatOptions;
}): string;
/**
 * Formats a currency value according to the specified languages, currency, and options.
 * @param {Object} params - The parameters for the currency formatting.
 * @param {number} params.value - The currency value to format.
 * @param {string} params.currency - The currency code (e.g., 'USD').
 * @param {string | string[]} [params.locales=['en-US']] - The locale codes to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for currency formatting.
 * @returns {string} The formatted currency value.
 */
export declare function formatCurrency(params: {
    value: number;
    currency: string;
    locales?: string | string[];
    options?: Intl.NumberFormatOptions;
}): string;
/**
 * Formats a list of items according to the specified locales and options.
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<string | number>} params.value - The list of items to format.
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 * @returns {string} The formatted list.
 */
export declare function formatList(params: {
    value: Array<string | number>;
    locales?: string | string[];
    options?: Intl.ListFormatOptions;
}): string;
/**
 * Formats a relative time value according to the specified locales and options.
 * @param {Object} params - The parameters for the relative time formatting.
 * @param {number} params.value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} params.unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year').
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.RelativeTimeFormatOptions} [params.options={}] - Additional options for relative time formatting.
 * @returns {string} The formatted relative time string.
 */
export declare function formatRelativeTime(params: {
    value: number;
    unit: Intl.RelativeTimeFormatUnit;
    locales?: string | string[];
    options?: Intl.RelativeTimeFormatOptions;
}): string;
/**
 * Splits a string into an array of text and variable objects.
 * @param {string} string - The input string to split.
 * @returns {Content} - An array containing strings and variables.
 */
export declare function splitStringToContent(string: string): Content;
/**
 * Renders content to a string by replacing variables with their formatted values.
 * @param {Content} content - The content to render.
 * @param {string | string[]} [locales='en-US'] - The locale(s) to use for formatting.
 * @param {Record<string, any>} [variables={}] - An object containing variable values.
 * @param {Record<string, any>} [variableOptions={}] - An object containing options for formatting variables.
 * @returns {string} - The rendered string with variables replaced by their formatted values.
 */
export declare function renderContentToString(content: Content, locales?: string | string[], variables?: Record<string, any>, variableOptions?: Record<string, any>): string;
/**
 * Determines the best matching locale from the provided approved locales list.
 * @param {string | string[]} locales - A single locale or an array of locales sorted in preference order.
 * @param {string[]} approvedLocales - An array of approved locales, also sorted by preference.
 * @returns {string | undefined} - The best matching locale from the approvedLocales list, or undefined if no match is found.
 */
export declare function determineLocale(locales: string | string[], approvedLocales: string[]): string | undefined;
/**
 * Determines whether a translation is required based on the source and target locales.
 *
 * - If the target locale is not specified, the function returns `false`, as translation is not needed.
 * - If the source and target locale are the same, returns `false`, indicating that no translation is necessary.
 * - If the `approvedLocales` array is provided, and the target locale is not within that array, the function also returns `false`.
 * - Otherwise, it returns `true`, meaning that a translation is required.
 *
 * @param {string} sourceLocale - The locale code for the original content (BCP 47 locale code).
 * @param {string} targetLocale - The locale code of the language to translate the content into (BCP 47 locale code).
 * @param {string[]} [approvedLocale] - An optional array of approved target locales.
 *
 * @returns {boolean} - Returns `true` if translation is required, otherwise `false`.
 */
export declare function requiresTranslation(sourceLocale: string, targetLocale: string, approvedLocales?: string[]): boolean;
export default GT;
