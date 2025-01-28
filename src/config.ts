import path from 'path';
import fs from 'fs';
import { NextConfig } from 'next';
import defaultInitGTProps from './config/props/defaultInitGTProps';
import InitGTProps from './config/props/InitGTProps';
import {
  APIKeyMissingError,
  createUnsupportedLocalesWarning,
  projectIdMissingError,
} from './errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import { defaultRenderSettings } from 'gt-react/internal';

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
 * @param {string|undefined} config - Optional config filepath (defaults to './gt.config.json'). If a file is found, it will be parsed for GT config variables.
 * @param {string|undefined} i18n - Optional i18n configuration file path. If a string is provided, it will be used as a path.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [devApiKey=defaultInitGTProps.devApiKey] - API key for dev environment only.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - How long to cache translations in memory (milliseconds).
 * @param {boolean} [runtimeTranslation=defaultInitGTProps.runtimeTranslation] - Whether to enable runtime translation.
 * @param {boolean} [remoteCache=defaultInitGTProps.remoteCache] - Whether to enable remote caching of translations.
 * @param {string[]} [locales=defaultInitGTProps.locales] - List of supported locales for the application.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @returns {function(NextConfig): NextConfig} - A function that accepts a Next.js config object and returns an updated config with GT settings applied.
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 *
 */
export function initGT({
  config = './gt.config.json',
  i18n,
  dictionary,
  runtimeTranslation = defaultInitGTProps.runtimeTranslation,
  remoteCache = defaultInitGTProps.remoteCache,
  apiKey = defaultInitGTProps.apiKey,
  devApiKey,
  projectId = defaultInitGTProps.projectId,
  runtimeUrl = defaultInitGTProps.runtimeUrl,
  cacheUrl = defaultInitGTProps.cacheUrl,
  cacheExpiryTime = defaultInitGTProps.cacheExpiryTime,
  locales = defaultInitGTProps.locales,
  defaultLocale = defaultInitGTProps.defaultLocale,
  renderSettings = defaultRenderSettings,
  maxConcurrentRequests = defaultInitGTProps.maxConcurrentRequests,
  maxBatchSize = defaultInitGTProps.maxBatchSize,
  batchInterval = defaultInitGTProps.batchInterval,
  ...metadata
}: InitGTProps = defaultInitGTProps) {
  // Load from config file if it's a string and exists
  let loadedConfig: Partial<InitGTProps> = {};
  try {
    if (typeof config === 'string' && fs.existsSync(config)) {
      const fileContent = fs.readFileSync(config, 'utf-8');
      loadedConfig = JSON.parse(fileContent);
    }
    if (loadedConfig.locales?.length === 0) {
      loadedConfig.locales = locales;
    }
  } catch (error) {
    console.error('Error reading GT config file:', error);
  }

  // Merge loaded file config, default props, and function args
  const mergedConfig: InitGTProps = {
    ...defaultInitGTProps,
    ...loadedConfig,
    ...{
      i18n,
      dictionary,
      runtimeTranslation,
      remoteCache,
      apiKey,
      devApiKey,
      projectId,
      runtimeUrl,
      cacheUrl,
      cacheExpiryTime,
      locales,
      defaultLocale,
      renderSettings,
      maxConcurrentRequests,
      maxBatchSize,
      batchInterval,
      ...metadata,
    },
  };

  // Destructure final config
  const {
    i18n: finalI18n,
    dictionary: finalDictionary,
    runtimeTranslation: finalRuntimeTranslation,
    remoteCache: finalRemoteCache,
    apiKey: finalApiKey,
    devApiKey: finalDevApiKey,
    projectId: finalProjectId,
    runtimeUrl: finalRuntimeUrl,
    cacheUrl: finalCacheUrl,
    cacheExpiryTime: finalCacheExpiryTime,
    locales: finalLocales,
    defaultLocale: finalDefaultLocale,
    renderSettings: finalRenderSettings,
    maxConcurrentRequests: finalMaxConcurrentRequests,
    maxBatchSize: finalMaxBatchSize,
    batchInterval: finalBatchInterval,
    ...restMetadata
  } = mergedConfig;

  // ----- ERROR CHECKS ----- //
  if (finalRuntimeTranslation || finalRemoteCache) {
    if (!finalProjectId) {
      console.error(projectIdMissingError);
    }
  }

  const envApiKey = process.env.GT_API_KEY || '';
  const apiKeyType = envApiKey.split('-')?.[1];
  let resolvedApiKey = finalApiKey;
  let resolvedDevApiKey = finalDevApiKey;

  if (apiKeyType === 'api') {
    resolvedApiKey = envApiKey;
  } else if (apiKeyType === 'dev') {
    resolvedDevApiKey = envApiKey;
  }

  if (finalRuntimeTranslation && !resolvedApiKey && !resolvedDevApiKey) {
    console.error(APIKeyMissingError);
  }

  if (
    finalRuntimeUrl === defaultInitGTProps.runtimeUrl ||
    finalCacheUrl === defaultInitGTProps.cacheUrl
  ) {
    const warningLocales = (finalLocales || defaultInitGTProps.locales).filter(
      (locale) => !getSupportedLocale(locale)
    );
    if (warningLocales.length)
      console.warn(createUnsupportedLocalesWarning(warningLocales));
  }

  // Store config params in environment variable to allow for global access (in some cases)
  const I18NConfigParams = JSON.stringify({
    remoteCache: finalRemoteCache,
    runtimeTranslation: finalRuntimeTranslation,
    apiKey: resolvedApiKey,
    devApiKey: resolvedDevApiKey,
    projectId: finalProjectId,
    runtimeUrl: finalRuntimeUrl,
    cacheUrl: finalCacheUrl,
    cacheExpiryTime: finalCacheExpiryTime,
    locales: finalLocales,
    defaultLocale: finalDefaultLocale,
    renderSettings: finalRenderSettings,
    maxConcurrentRequests: finalMaxConcurrentRequests,
    maxBatchSize: finalMaxBatchSize,
    batchInterval: finalBatchInterval,
    ...restMetadata,
  });

  // Resolve i18n and dictionary paths
  const resolvedI18NFilePath =
    typeof finalI18n === 'string' ? finalI18n : resolveConfigFilepath('i18n');
  const resolvedDictionaryFilePath =
    typeof finalDictionary === 'string'
      ? finalDictionary
      : resolveConfigFilepath('dictionary');

  return (nextConfig: any = {}): any => {
    return {
      ...nextConfig,
      env: {
        ...nextConfig.env,
        _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams,
      },
      webpack: function webpack(
        ...[webpackConfig, options]: Parameters<
          NonNullable<NextConfig['webpack']>
        >
      ) {
        if (resolvedI18NFilePath) {
          webpackConfig.resolve.alias['gt-next/_request'] = path.resolve(
            webpackConfig.context,
            resolvedI18NFilePath
          );
        }
        if (resolvedDictionaryFilePath) {
          webpackConfig.resolve.alias['gt-next/_dictionary'] = path.resolve(
            webpackConfig.context,
            resolvedDictionaryFilePath
          );
        }
        if (typeof nextConfig?.webpack === 'function') {
          return nextConfig.webpack(webpackConfig, options);
        }
        return webpackConfig;
      },
    };
  };
}

/**
 * Resolves a configuration filepath for i18n or dictionary files.
 *
 * @param {string} fileName - The base name of the config file to look for.
 * @param {string} [cwd] - An optional current working directory path.
 * @returns {string|undefined} - The path if found; otherwise undefined.
 */
function resolveConfigFilepath(
  fileName: string,
  cwd?: string
): string | undefined {
  function resolvePath(pathname: string) {
    const parts = [];
    if (cwd) parts.push(cwd);
    parts.push(pathname);
    return path.resolve(...parts);
  }

  function pathExists(pathname: string) {
    return fs.existsSync(resolvePath(pathname));
  }

  // Check for file existence in the root and src directories with supported extensions
  for (const candidate of [
    ...withExtensions(`./${fileName}`),
    ...withExtensions(`./src/${fileName}`),
  ]) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  // Return undefined if no file is found
  return undefined;
}

/**
 * Helper function to handle multiple extensions.
 *
 * @param {string} localPath - The local path to which extensions will be appended.
 * @returns {string[]} - Array of possible paths with supported TypeScript/JavaScript extensions.
 */
function withExtensions(localPath: string) {
  return [
    `${localPath}.ts`,
    `${localPath}.tsx`,
    `${localPath}.js`,
    `${localPath}.jsx`,
  ];
}
