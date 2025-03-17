import withGTConfigProps from './config-dir/props/withGTConfigProps';
import GTRouter from './config-dir/gt-router';
export { GTRouter };
/**
 * Initializes General Translation settings for a Next.js application.
 *
 * Use it in `next.config.js` to enable GT translation functionality as a plugin.
 *
 * @example
 * // In next.config.mjs
 * import { withGTConfig } from 'gt-next/config';
 *
 * export default withGTConfig(nextConfig, {
 *   projectId: 'abc-123',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * })
 *
 * @param {string|undefined} config - Optional config filepath (defaults to './gt.config.json'). If a file is found, it will be parsed for GT config variables.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [devApiKey=defaultInitGTProps.devApiKey] - API key for dev environment only.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string|null} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations. Set to null to disable.
 * @param {string|null} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations. Set to null to disable.
 * @param {string[]|undefined} - Whether to use local translations.
 * @param {string[]} [locales=defaultInitGTProps.locales] - List of supported locales for the application.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - The time in milliseconds for how long translations should be cached.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @param {NextConfig} nextConfig - The Next.js configuration object to extend
 * @param {withGTConfigProps} props - General Translation configuration properties
 * @returns {NextConfig} - An updated Next.js config with GT settings applied
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 */
export declare function withGTConfig(nextConfig?: any, props?: withGTConfigProps): any;
export declare const initGT: (props: withGTConfigProps) => (nextConfig: any) => any;
//# sourceMappingURL=config.d.ts.map