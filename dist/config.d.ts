import { NextConfig } from 'next';
import InitGTProps from './config/props/InitGTProps';
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
 *   projectId: 'abc-123',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * });
 *
 * export default withGT({})
 *
 * @param {string|undefined} i18n - Optional i18n configuration file path. If a string is provided, it will be used as a path.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string} [baseUrl=defaultInitGTProps.baseUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [clientBaseUrl=defaultInitGTProps.clientBaseUrl] - The client base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations.
 * @param {string[]} [locales] - List of supported locales for the application. Defaults to the first locale or the default locale if not provided.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [_maxConcurrentRequests=defaultInitGTProps._maxConcurrectRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [_maxBatchSize=defaultInitGTProps._maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [_batchInterval=defaultInitGTProps._batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @returns {function(NextConfig): NextConfig} - A function that accepts a Next.js config object and returns an updated config with GT settings applied.
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 *
 */
export declare function initGT({ i18n, dictionary, apiKey, devApiKey, projectId, baseUrl, clientBaseUrl, cacheUrl, cacheExpiryTime, locales, defaultLocale, renderSettings, env, _maxConcurrentRequests, _maxBatchSize, _batchInterval, ...metadata }?: InitGTProps): (config?: NextConfig) => any;
//# sourceMappingURL=config.d.ts.map