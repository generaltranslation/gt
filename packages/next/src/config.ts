import path from 'path';
import fs from 'fs';
import { NextConfig } from 'next';
import defaultInitGTProps from './config-dir/props/defaultInitGTProps';
import InitGTProps from './config-dir/props/InitGTProps';
import {
  APIKeyMissingWarn,
  createUnsupportedLocalesWarning,
  devApiKeyIncludedInProductionError,
  projectIdMissingWarn,
} from './errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';

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
 * @param {boolean} [runtimeTranslation=defaultInitGTProps.runtimeTranslation] - Whether to enable runtime translation.
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
 * @param {InitGTProps} props - General Translation configuration properties
 * @returns {NextConfig} - An updated Next.js config with GT settings applied
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing.
 */
export function withGTConfig(nextConfig: any = {}, props: InitGTProps = {}) {
  // ---------- LOAD GT CONFIG FILE ---------- //
  let loadedConfig: Partial<InitGTProps> = {};
  const configPath = props.config || defaultInitGTProps.config;
  try {
    if (typeof configPath === 'string' && fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
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
    _usingPlugin: true, // flag to indicate plugin usage
  };

  // ----------- LOCALE STANDARDIZATION ----------- //
  if (mergedConfig.locales && mergedConfig.defaultLocale) {
    mergedConfig.locales.unshift(mergedConfig.defaultLocale);
  }
  mergedConfig.locales = Array.from(new Set(mergedConfig.locales));

  // ----------- RESOLVE ANY EXTERNAL FILES ----------- //

  // Resolve dictionary filepath
  const resolvedDictionaryFilePath =
    typeof mergedConfig.dictionary === 'string'
      ? mergedConfig.dictionary
      : resolveConfigFilepath('dictionary', ['.ts', '.js', '.json']);

  // Get the type of dictionary file
  const resolvedDictionaryFilePathType = resolvedDictionaryFilePath
    ? path.extname(resolvedDictionaryFilePath)
    : undefined;
  if (resolvedDictionaryFilePathType) {
    mergedConfig['_dictionaryFileType'] = resolvedDictionaryFilePathType;
  }

  // Resolve custom translation loader path
  const customLoadTranslationPath =
    typeof mergedConfig.loadTranslationPath === 'string'
      ? mergedConfig.loadTranslationPath
      : resolveConfigFilepath('loadTranslation');

  // Resolve custom message loader path
  const customLoadMessagePath =
    typeof mergedConfig.loadMessagePath === 'string'
      ? mergedConfig.loadMessagePath
      : resolveConfigFilepath('loadMessages');

  // ----- CUSTOM CONTENT LOADER FLAGS ----- //

  // Local messages flag
  if (
    customLoadMessagePath &&
    fs.existsSync(path.resolve(customLoadMessagePath))
  ) {
    mergedConfig.loadMessagesEnabled = true;
  }

  // Local translations flag
  if (
    customLoadTranslationPath &&
    fs.existsSync(path.resolve(customLoadTranslationPath))
  ) {
    mergedConfig.loadTranslationType = 'custom';
  }

  // ---------- ERROR CHECKS ---------- //

  // Check: projectId is not required for remote infrastructure, but warn if missing for dev, nothing for prod
  if (
    (mergedConfig.cacheUrl || mergedConfig.runtimeUrl) &&
    !mergedConfig.projectId &&
    process.env.NODE_ENV === 'development' &&
    mergedConfig.loadTranslationType !== 'custom'
  ) {
    console.warn(projectIdMissingWarn);
  }

  // Check: dev API key should not be included in production
  if (process.env.NODE_ENV === 'production' && mergedConfig.devApiKey) {
    throw new Error(devApiKeyIncludedInProductionError);
  }

  // Check: An API key is required for runtime translation
  if (
    mergedConfig.projectId && // must have projectId for this check to matter anyways
    mergedConfig.runtimeUrl &&
    mergedConfig.loadTranslationType !== 'custom' && // this usually conincides with not using runtime tx
    !(mergedConfig.apiKey || mergedConfig.devApiKey) &&
    process.env.NODE_ENV === 'development'
  ) {
    console.warn(APIKeyMissingWarn);
  }

  // Check: if using GT infrastructure, warn about unsupported locales
  if (
    mergedConfig.runtimeUrl === defaultInitGTProps.runtimeUrl ||
    (mergedConfig.cacheUrl === defaultInitGTProps.cacheUrl &&
      mergedConfig.loadTranslationType === 'remote')
  ) {
    const warningLocales = (
      mergedConfig.locales || defaultInitGTProps.locales
    ).filter((locale) => !getSupportedLocale(locale));
    if (warningLocales.length) {
      console.warn(createUnsupportedLocalesWarning(warningLocales));
    }
  }

  // ---------- STORE CONFIGURATIONS ---------- //
  const I18NConfigParams = JSON.stringify(mergedConfig);

  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams,
      ...(resolvedDictionaryFilePathType && {
        _GENERALTRANSLATION_DICTIONARY_FILE_TYPE:
          resolvedDictionaryFilePathType,
      }),
      _GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED:
        (!!customLoadTranslationPath).toString(),
      _GENERALTRANSLATION_LOCAL_MESSAGE_ENABLED:
        (!!customLoadMessagePath).toString(),
      _GENERALTRANSLATION_DEFAULT_LOCALE: (
        mergedConfig.defaultLocale || defaultInitGTProps.defaultLocale
      ).toString(),
    },
    experimental: {
      ...nextConfig.experimental,
      // Only include turbo config if Turbopack is enabled or already configured
      ...(process.env.TURBOPACK === '1' || nextConfig.experimental?.turbo
        ? {
            turbo: {
              ...(nextConfig.experimental?.turbo || {}),
              resolveAlias: {
                ...(nextConfig.experimental?.turbo?.resolveAlias || {}),
                'gt-next/_dictionary': resolvedDictionaryFilePath || '',
                'gt-next/_load-translation': customLoadTranslationPath || '',
                'gt-next/_load-messages': customLoadMessagePath || '',
              },
            },
          }
        : {}),
    },
    webpack: function webpack(
      ...[webpackConfig, options]: Parameters<
        NonNullable<NextConfig['webpack']>
      >
    ) {
      // Only apply webpack aliases if we're using webpack (not Turbopack)
      const isTurbopack =
        (options as any)?.turbo || process.env.TURBOPACK === '1';

      if (!isTurbopack) {
        // Disable cache in dev bc people might move around loadTranslation() and loadMessages() files
        if (process.env.NODE_ENV === 'development') {
          webpackConfig.cache = false;
        }
        if (resolvedDictionaryFilePath) {
          webpackConfig.resolve.alias['gt-next/_dictionary'] = path.resolve(
            webpackConfig.context,
            resolvedDictionaryFilePath
          );
        }
        if (customLoadTranslationPath) {
          webpackConfig.resolve.alias[`gt-next/_load-translation`] =
            path.resolve(webpackConfig.context, customLoadTranslationPath);
        }
        if (customLoadMessagePath) {
          webpackConfig.resolve.alias[`gt-next/_load-messages`] = path.resolve(
            webpackConfig.context,
            customLoadMessagePath
          );
        }
      }
      if (typeof nextConfig?.webpack === 'function') {
        return nextConfig.webpack(webpackConfig, options);
      }
      return webpackConfig;
    },
  };
}

// Keep initGT for backward compatibility
export const initGT = (props: InitGTProps) => (nextConfig: any) =>
  withGTConfig(nextConfig, props);

/**
 * Resolves a configuration filepath for dictionary files.
 *
 * @param {string} fileName - The base name of the config file to look for.
 * @param {string} [cwd] - An optional current working directory path.
 * @returns {string|undefined} - The path if found; otherwise undefined.
 */
function resolveConfigFilepath(
  fileName: string,
  extensions: string[] = ['.ts', '.js'],
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
    ...extensions.map((ext) => `./${fileName}${ext}`),
    ...extensions.map((ext) => `./src/${fileName}${ext}`),
  ]) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  // Return undefined if no file is found
  return undefined;
}
