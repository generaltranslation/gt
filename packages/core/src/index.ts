// `generaltranslation` language toolkit
// © 2024, General Translation, Inc.

// ----- IMPORTS ----- //

import _translateBatch from './api/batch/translateBatch';
import _requiresTranslation from './locales/requiresTranslation';
import _translate from './api/translate/translate';
import _translateJsx from './api/jsx/translateJsx';
import _updateProjectTranslations from './projects/updateProjectTranslations';
import _getProjectLocales from './projects/getProjectLocales';
import _determineLocale from './locales/determineLocale';
import { _formatNum, _formatCurrency, _formatList, _formatRelativeTime, _formatDateTime } from './formatting/format';
import { _splitStringToContent, _renderContentToString } from './formatting/string_content'
import { Content, Update, Request, JsxChildren, JsxTranslationResult, ContentTranslationResult, TranslationError } from './types'
import _isSameLanguage from './locales/isSameLanguage';
import _getLocaleProperties from './locales/getLocaleProperties';
import _getLocaleEmoji from './locales/getLocaleEmoji';
import { _isValidLocale, _standardizeLocale } from './locales/isValidLocale';
import { _getLocaleName } from './locales/getLocaleName';
import { _getLocaleDirection } from './locales/getLocaleDirection';
import { defaultBaseUrl, libraryDefaultLocale } from './internal';
import _isSameDialect from './locales/isSameDialect';

// ----- HELPER FUNCTIONS ----- //

const getDefaultFromEnv = (VARIABLE: string): string => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[VARIABLE] || '';
    }
    return '';
}

// ----- CORE CLASS ----- // 



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
class GT {
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
    constructor({
        apiKey = '',
        devApiKey = '',
        sourceLocale = '',
        projectId = '',
        baseUrl = defaultBaseUrl
    }: GTConstructorParams = {}) {
        this.apiKey = apiKey || getDefaultFromEnv('GT_API_KEY');
        this.devApiKey = devApiKey || getDefaultFromEnv('GT_DEV_API_KEY');
        this.projectId = projectId || getDefaultFromEnv('GT_PROJECT_ID');
        this.sourceLocale = _standardizeLocale(sourceLocale) || '';
        this.baseUrl = baseUrl;
    }

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
    async translate(
        source: Content, 
        locale: string, 
        metadata?: { 
            context?: string,
            id?: string,
            publish?: boolean,
            fast?: boolean,
            sourceLocale?: string,
            [key: string]: any
        }
    ): Promise<ContentTranslationResult | TranslationError> {
        return await _translate(this, source, locale, { sourceLocale: this.sourceLocale, ...metadata })
    }

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
    async translateJsx(
        source: JsxChildren, 
        locale: string, 
        metadata?: { 
            context?: string,
            id?: string,
            publish?: boolean,
            fast?: boolean,
            sourceLocale?: string,
            [key: string]: any
        }
    ): Promise<JsxTranslationResult | TranslationError> {
        return await _translateJsx(this, source, locale, { sourceLocale: this.sourceLocale, ...metadata });
    }
}

// ----- EXPORTS ----- //

/**
 * Get the text direction for a given locale code using the Intl.Locale API.
 * 
 * @param {string} locale - The locale code to check.
 * @returns {string} - 'rtl' if the locale is right-to-left, otherwise 'ltr'.
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl'  {
    return _getLocaleDirection(locale);
};

/**
 * Retrieves the display name of locale code using Intl.DisplayNames.
 *
 * @param {string} locale - A BCP-47 locale code.
 * @param {string} [defaultLocale = 'en-US'] - The locale for display names.
 * @returns {string} The display name corresponding to the code.
 */
export function getLocaleName(locale: string, defaultLocale : string = libraryDefaultLocale): string {
    return _getLocaleName(locale, defaultLocale);
};

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
export function getLocaleProperties(locale: string, defaultLocale?: string): {
    // assume code = "de-AT", defaultLocale = "en-US"
    code: string; // "de-AT"
    name: string; // "Austrian German"
    nativeName: string; // "Österreichisches Deutsch"
    languageCode: string; // "de"
    languageName: string; // "German"
    nativeLanguageName: string; // "Deutsch"
    // note that maximize() is NOT called here!
    nameWithRegionCode: string // "German (AT)"
    nativeNameWithRegionCode: string // "Deutsch (AT)"
    // for most likely script and region, maximize() is called
    regionCode: string // "AT"
    regionName: string // "Austria"
    nativeRegionName: string // Österreich
    scriptCode: string; // "Latn"
    scriptName: string; // "Latin"
    nativeScriptName: string; // "Lateinisch"
    maximizedCode: string // "de-Latn-AT"
    maximizedName: string // "Austrian German (Latin)"
    nativeMaximizedName: string; // Österreichisches Deutsch (Lateinisch)
    minimizedCode: string; // "de-AT", but for "de-DE" it would just be "de"
    minimizedName: string; // ""Austrian German";
    nativeMinimizedName: string; // "Österreichisches Deutsch"
    // Emoji depending on region code
    // In order not to accidentally spark international conflict, some emojis are hard-coded
    emoji: string; 
} {
    return _getLocaleProperties(locale, defaultLocale)
};

/**
 * Retrieves an emoji based on a given locale code, taking into account region, language, and specific exceptions.
 * This function uses the locale's region (if present) to select an emoji or falls back on default emojis for certain languages.
 * 
 * @param code - A string representing the locale code (e.g., 'en-US', 'fr-CA').
 * @param custom - An optional custom mapping of locale codes to emojis.
 * @returns The emoji representing the locale or its region, or a default emoji if no specific match is found.
*/
export function getLocaleEmoji(locale: string, custom?: Record<string, string>) {
    return _getLocaleEmoji(locale, custom);
}


/**
 * Checks if a given BCP 47 locale code is valid.
 * @param {string} locale - The BCP 47 locale code to validate.
 * @returns {boolean} True if the BCP 47 code is valid, false otherwise.
 */
export function isValidLocale(locale: string): boolean {
    return _isValidLocale(locale);
};

/**
 * Standardizes a BCP 47 locale code to ensure correct formatting.
 * @param {string} locale - The BCP 47 locale code to standardize.
 * @returns {string} The standardized BCP 47 locale code or an empty string if it is an invalid code.
 */
export function standardizeLocale(locale: string): string {
    return _standardizeLocale(locale);
};

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
export function isSameDialect(...locales: (string | string[])[]): boolean {
    return _isSameDialect(...locales)
};

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
export function isSameLanguage(...locales: (string | string[])[]): boolean {
    return _isSameLanguage(...locales)
};

/**
 * Formats a number according to the specified locales and options.
 * @param {Object} params - The parameters for the number formatting.
 * @param {number} params.value - The number to format.
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for number formatting.
 * @returns {string} The formatted number.
 */
export function formatNum(params: { value: number; locales?: string | string[]; options?: Intl.NumberFormatOptions }): string {
    return _formatNum(params);
};

/**
 * Formats a date according to the specified languages and options.
 * @param {Object} params - The parameters for the date formatting.
 * @param {Date} params.value - The date to format.
 * @param {string | string[]} [params.locales=['en-US']] - The languages to use for formatting.
 * @param {Intl.DateTimeFormatOptions} [params.options={}] - Additional options for date formatting.
 * @returns {string} The formatted date.
 */
export function formatDateTime(params: { value: Date; locales?: string | string[]; options?: Intl.DateTimeFormatOptions }): string {
    return _formatDateTime(params);
};

/**
 * Formats a currency value according to the specified languages, currency, and options.
 * @param {Object} params - The parameters for the currency formatting.
 * @param {number} params.value - The currency value to format.
 * @param {string} params.currency - The currency code (e.g., 'USD').
 * @param {string | string[]} [params.locales=['en-US']] - The locale codes to use for formatting.
 * @param {Intl.NumberFormatOptions} [params.options={}] - Additional options for currency formatting.
 * @returns {string} The formatted currency value.
 */
export function formatCurrency(params: { value: number; currency: string; locales?: string | string[]; options?: Intl.NumberFormatOptions }): string {
    return _formatCurrency(params);
};

/**
 * Formats a list of items according to the specified locales and options.
 * @param {Object} params - The parameters for the list formatting.
 * @param {Array<string | number>} params.value - The list of items to format.
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.ListFormatOptions} [params.options={}] - Additional options for list formatting.
 * @returns {string} The formatted list.
 */
export function formatList(params: { value: Array<string | number>; locales?: string | string[]; options?: Intl.ListFormatOptions }) {
    return _formatList(params);
};

/**
 * Formats a relative time value according to the specified locales and options.
 * @param {Object} params - The parameters for the relative time formatting.
 * @param {number} params.value - The relative time value to format.
 * @param {Intl.RelativeTimeFormatUnit} params.unit - The unit of time (e.g., 'second', 'minute', 'hour', 'day', 'week', 'month', 'year').
 * @param {string | string[]} [params.locales=['en-US']] - The locales to use for formatting.
 * @param {Intl.RelativeTimeFormatOptions} [params.options={}] - Additional options for relative time formatting.
 * @returns {string} The formatted relative time string.
 */
export function formatRelativeTime(params: { value: number; unit: Intl.RelativeTimeFormatUnit; locales?: string | string[]; options?: Intl.RelativeTimeFormatOptions }): string {
    return _formatRelativeTime(params);
};

/**
 * Splits a string into an array of text and variable objects.
 * @param {string} string - The input string to split.
 * @returns {Content} - An array containing strings and variables.
 */
export function splitStringToContent(string: string): Content {
    return _splitStringToContent(string);
};

/**
 * Renders content to a string by replacing variables with their formatted values.
 * @param {Content} content - The content to render.
 * @param {string | string[]} [locales='en-US'] - The locale(s) to use for formatting.
 * @param {Record<string, any>} [variables={}] - An object containing variable values.
 * @param {Record<string, any>} [variableOptions={}] - An object containing options for formatting variables.
 * @returns {string} - The rendered string with variables replaced by their formatted values.
 */
export function renderContentToString(content: Content, locales?: string | string[], variables?: Record<string, any>, variableOptions?: Record<string, any>): string {
    return _renderContentToString(content, locales, variables, variableOptions)
};

/**
 * Determines the best matching locale from the provided approved locales list.
 * @param {string | string[]} locales - A single locale or an array of locales sorted in preference order.
 * @param {string[]} approvedLocales - An array of approved locales, also sorted by preference.
 * @returns {string | undefined} - The best matching locale from the approvedLocales list, or undefined if no match is found.
 */
export function determineLocale(locales: string | string[], approvedLocales: string[]): string | undefined {
    return _determineLocale(locales, approvedLocales);
};

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
export function requiresTranslation(sourceLocale: string, targetLocale: string, approvedLocales?: string[]): boolean {
    return _requiresTranslation(sourceLocale, targetLocale, approvedLocales);
};

// DEFAULT EXPORT

export default GT;