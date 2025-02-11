import path from 'path';
import fs from 'fs';
import { NextConfig } from 'next';
import defaultInitGTProps from './config-dir/props/defaultInitGTProps';
import InitGTProps from './config-dir/props/InitGTProps';
import {
  APIKeyMissingError,
  createUnsupportedLocalesWarning,
  devApiKeyIncludedInProductionError,
  projectIdMissingWarn,
} from './errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import { ContextReplacementPlugin } from 'webpack';

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
 * @param {string|undefined} srcDir - Optional directory path for source translation files. If a directory is provided, translations will be resolved via this path first.
 * @param {string} [apiKey=defaultInitGTProps.apiKey] - API key for the GeneralTranslation service. Required if using the default GT base URL.
 * @param {string} [devApiKey=defaultInitGTProps.devApiKey] - API key for dev environment only.
 * @param {string} [projectId=defaultInitGTProps.projectId] - Project ID for the GeneralTranslation service. Required for most functionality.
 * @param {string} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations.
 * @param {string} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations.
 * @param {number} [cacheExpiryTime=defaultInitGTProps.cacheExpiryTime] - How long to cache translations in memory (milliseconds).
 * @param {boolean} [runtimeTranslation=defaultInitGTProps.runtimeTranslation] - Whether to enable runtime translation.
 * @param {boolean} [remoteCache=defaultInitGTProps.remoteCache] - Whether to use GT infrastructure for caching and translation, or rely on local source files.
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
export function initGT(props: InitGTProps = {}) {
  // ---------- LOAD GT CONFIG FILE ---------- //
  let loadedConfig: Partial<InitGTProps> = {};
  try {
    const config = props.config || defaultInitGTProps.config;
    if (typeof config === 'string' && fs.existsSync(config)) {
      const fileContent = fs.readFileSync(config, 'utf-8');
      loadedConfig = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading GT config file:', error);
  }

  // ---------- LOAD ENVIRONMENT VARIABLES ---------- //

  // resolve project ID
  const projectId: string | undefined = process.env.GT_PROJECT_ID;

  // resolve API keys
  const envApiKey: string | undefined = process.env.GT_API_KEY;
  let apiKey, devApiKey;
  if (envApiKey) {
    const apiKeyType = envApiKey?.split('-')?.[1];
    if (apiKeyType === 'api') {
      apiKey = envApiKey;
    } else if (apiKeyType === 'dev') {
      devApiKey = envApiKey;
    }
  }

  // conditionally add environment variables to config
  const envConfig: Partial<InitGTProps> = {
    ...(projectId ? { projectId } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(devApiKey ? { devApiKey } : {}),
  };

  // ---------- MERGE CONFIGS ---------- //

  // precedence: input > env > config file > defaults
  const mergedConfig: InitGTProps = {
    ...defaultInitGTProps,
    ...loadedConfig,
    ...envConfig,
    ...props,
  };

  // ----------- LOCALE STANDARDIZATION ----------- //
  if (mergedConfig.locales && mergedConfig.defaultLocale) {
    mergedConfig.locales.unshift(mergedConfig.defaultLocale);
  }
  mergedConfig.locales = Array.from(new Set(mergedConfig.locales));

  // ---------- ERROR CHECKS ---------- //

  // If using SaaS infrastructure
  if (mergedConfig.remoteCache || mergedConfig.runtimeTranslation) {
    // Check: projectId is not required, but warn if missing for dev, nothing for prod
    if (!mergedConfig.projectId && process.env.NODE_ENV === 'development') {
      console.warn(projectIdMissingWarn);
    }

    // Check: dev API key should not be included in production
    if (process.env.NODE_ENV === 'production' && mergedConfig.devApiKey) {
      throw new Error(devApiKeyIncludedInProductionError);
    }

    // Check: An API key is required for runtime translation
    if (
      mergedConfig.runtimeTranslation &&
      mergedConfig.apiKey &&
      mergedConfig.devApiKey
    ) {
      console.error(APIKeyMissingError);
    }

    // Check: if using GT infrastructure, warn about unsupported locales
    if (
      mergedConfig.runtimeUrl === defaultInitGTProps.runtimeUrl ||
      mergedConfig.cacheUrl === defaultInitGTProps.cacheUrl
    ) {
      const warningLocales = (
        mergedConfig.locales || defaultInitGTProps.locales
      ).filter((locale) => !getSupportedLocale(locale));
      if (warningLocales.length) {
        console.warn(createUnsupportedLocalesWarning(warningLocales));
      }
    }
  }

  // Check: srcDir must be a directory if provided
  if (mergedConfig.srcDir) {
    if (
      !fs.existsSync(mergedConfig.srcDir) ||
      !fs.statSync(mergedConfig.srcDir).isDirectory()
    ) {
      throw new Error(
        `srcDir "${mergedConfig.srcDir}" must be a valid directory`
      );
    }
  }

  // ---------- STORE CONFIGURATIONS ---------- //

  // Resolve gt.config.json i18n and dictionary paths
  const resolvedI18NFilePath =
    typeof mergedConfig.i18n === 'string'
      ? mergedConfig.i18n
      : resolveConfigFilepath('i18n');
  const resolvedDictionaryFilePath =
    typeof mergedConfig.dictionary === 'string'
      ? mergedConfig.dictionary
      : resolveConfigFilepath('dictionary');
  const resolvedConfigFilePath = resolveConfigFilepath('gt.config');

  // Store the resolved paths in the environment
  const I18NConfigParams = JSON.stringify(mergedConfig);
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
        if (resolvedConfigFilePath) {
          webpackConfig.resolve.alias[`gt-next/_source`] = path.resolve(
            webpackConfig.context,
            resolvedConfigFilePath
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
