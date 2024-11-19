import defaultInitGTProps from "./primitives/defaultInitGTProps";
import InitGTProps from "./primitives/InitGTProps";
import path from 'path';
import { NextConfig } from "next";

/**
 * Initializes General Translation settings for a Next.js application.
 * 
 * Use it in `next.config.js` to enable GT translation functionality as a plugin.
 * 
 * @example
 * // In next.config.mjs
 * import { initGT } from 'gt-next/config';
 * 
 * const withGT = initGT({
 *   projectID: 'abc-123',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * });
 * 
 * export default withGT({})
 * 
 * @param {string|undefined} i18n - Optional i18n configuration file path. If a string is provided, it will be used as a path.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [projectID=defaultInitGTProps.projectID] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string} [baseURL=defaultInitGTProps.baseURL] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheURL=defaultInitGTProps.cacheURL] - The URL for cached translations.
 * @param {string[]} [locales] - List of supported locales for the application. Defaults to the first locale or the default locale if not provided.
 * @param {string} [defaultLocale=locales?.[0] || defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [_maxConcurrentRequests=defaultInitGTProps._maxConcurrectRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [_batchInterval=defaultInitGTProps._batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 * 
 * @returns {function(NextConfig): NextConfig} - A function that accepts a Next.js config object and returns an updated config with GT settings applied.
 * 
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 * 
 */
export function initGT({
    i18n, dictionary,
    apiKey = defaultInitGTProps.apiKey, 
    projectID = defaultInitGTProps.projectID,
    baseURL = defaultInitGTProps.baseURL,
    cacheURL = defaultInitGTProps.cacheURL,
    locales,
    defaultLocale = locales?.[0] || defaultInitGTProps.defaultLocale,
    renderSettings = defaultInitGTProps.renderSettings,
    _maxConcurrentRequests = defaultInitGTProps._maxConcurrectRequests,
    _batchInterval = defaultInitGTProps._batchInterval,
    ...metadata
}: InitGTProps = defaultInitGTProps) {

    // Error checks
    if (!projectID && ((cacheURL === defaultInitGTProps.cacheURL) || (baseURL === defaultInitGTProps.baseURL)))
        console.error('Project ID missing! Set projectID as GT_PROJECT_ID in the environment or by passing the projectID parameter to initGT(). Find your project ID: www.generaltranslation.com/dashboard.')

    if ((!apiKey || !projectID) && (baseURL === defaultInitGTProps.baseURL)) {
        console.error("API key is required for automatic translation! Create an API key: www.generaltranslation.com/dashboard/api-keys. (Or, turn off automatic translation by setting baseURL to an empty string.)")
    }

    const I18NConfigParams = JSON.stringify({
        apiKey, projectID, baseURL, cacheURL, locales, defaultLocale,
        renderSettings,
        maxConcurrentRequests: _maxConcurrentRequests,
        batchInterval: _batchInterval, ...metadata
    });

    // Use i18n and dictionary values as file paths if they are provided as such
    const resolvedI18NFilePath = typeof i18n === 'string' ? i18n : resolveConfigFilepath('i18n');
    const resolvedDictionaryFilePath = typeof dictionary === 'string' ? dictionary : resolveConfigFilepath('dictionary');

    return (config: NextConfig = {}): NextConfig => {
        return {
            ...config,
            env: {
                ...config.env,
                _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams
            },
            webpack: function webpack(
                ...[webpackConfig, options]: Parameters<NonNullable<NextConfig['webpack']>>
            ) {
                if (resolvedI18NFilePath) {
                    // Add alias for importing request handler
                    webpackConfig.resolve.alias['gt-next/_request'] = path.resolve(
                        webpackConfig.context,
                        resolvedI18NFilePath
                    );
                }
                if (resolvedDictionaryFilePath) {
                    // Add alias for importing dictionary via webpack
                    webpackConfig.resolve.alias['gt-next/_dictionary'] = path.resolve(
                        webpackConfig.context,
                        resolvedDictionaryFilePath
                    );
                }
                if (typeof config?.webpack === 'function') {
                    return config.webpack(webpackConfig, options);
                }
                return webpackConfig;
            }
        }
    }
}

// Function to search for both i18n.js and dictionary.js
function resolveConfigFilepath(fileName: string, cwd?: string): string | undefined {
    function resolvePath(pathname: string) {
        const parts = [];
        if (cwd) parts.push(cwd);
        parts.push(pathname);
        return path.resolve(...parts);
    }

    function pathExists(pathname: string) {
        return require('fs').existsSync(resolvePath(pathname));
    }

    // Check for file existence in the root and src directories with supported extensions
    for (const candidate of [
        ...withExtensions(`./${fileName}`),
        ...withExtensions(`./src/${fileName}`)
    ]) {
        if (pathExists(candidate)) {
            return candidate;
        }
    }

    // Return undefined if no file is found
    return undefined;
}

// Helper function to handle multiple extensions
function withExtensions(localPath: string) {
    return [
        `${localPath}.ts`,
        `${localPath}.tsx`,
        `${localPath}.js`,
        `${localPath}.jsx`
    ];
}
