import path from 'path';
import fs from 'fs';
import { NextConfig } from 'next';
import defaultWithGTConfigProps from './config-dir/props/defaultWithGTConfigProps';
import withGTConfigProps from './config-dir/props/withGTConfigProps';
import {
  APIKeyMissingWarn,
  createUnsupportedLocalesWarning,
  devApiKeyIncludedInProductionError,
  projectIdMissingWarn,
  unresolvedLoadMessagesBuildError,
  unresolvedLoadTranslationsBuildError,
} from './errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import { getLocaleProperties } from 'generaltranslation';

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
export function withGTConfig(
  nextConfig: any = {},
  props: withGTConfigProps = {}
) {
  // ---------- LOAD GT CONFIG FILE ---------- //
  let loadedConfig: Partial<withGTConfigProps> = {};
  const configPath = props.config || defaultWithGTConfigProps.config;
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
  const envConfig: Partial<withGTConfigProps> = {
    ...(projectId ? { projectId } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(devApiKey ? { devApiKey } : {}),
  };

  // ---------- MERGE CONFIGS ---------- //

  // precedence: input > env > config file > defaults
  const mergedConfig: withGTConfigProps = {
    ...defaultWithGTConfigProps,
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
  let resolvedDictionaryFilePath =
    typeof mergedConfig.dictionary === 'string'
      ? mergedConfig.dictionary
      : resolveConfigFilepath('dictionary', ['.ts', '.js', '.json']); // fallback to dictionary

  // Check [defaultLocale].json file
  if (!resolvedDictionaryFilePath && mergedConfig.defaultLocale) {
    resolvedDictionaryFilePath = resolveConfigFilepath(
      mergedConfig.defaultLocale,
      ['.ts', '.js', '.json']
    );

    // Check [defaultLanguageCode].json file
    if (!resolvedDictionaryFilePath) {
      const defaultLanguage = getLocaleProperties(
        mergedConfig.defaultLocale
      )?.languageCode;

      if (defaultLanguage && defaultLanguage !== mergedConfig.defaultLocale) {
        resolvedDictionaryFilePath = resolveConfigFilepath(defaultLanguage, [
          '.ts',
          '.js',
          '.json',
        ]);
      }
    }
  }

  // Get the type of dictionary file
  const resolvedDictionaryFilePathType = resolvedDictionaryFilePath
    ? path.extname(resolvedDictionaryFilePath)
    : undefined;
  if (resolvedDictionaryFilePathType) {
    mergedConfig._dictionaryFileType = resolvedDictionaryFilePathType;
  }

  // Resolve custom message loader path
  const customLoadMessagesPath =
    typeof mergedConfig.loadMessagesPath === 'string'
      ? mergedConfig.loadMessagesPath
      : resolveConfigFilepath('loadMessages');

  // Resolve custom translation loader path
  const customLoadTranslationsPath =
    typeof mergedConfig.loadTranslationsPath === 'string'
      ? mergedConfig.loadTranslationsPath
      : resolveConfigFilepath('loadTranslations');

  // ---------- ERROR CHECKS ---------- //

  // Local messages flag
  if (customLoadMessagesPath) {
    // Check: file exists if provided
    if (!fs.existsSync(path.resolve(customLoadMessagesPath))) {
      throw new Error(unresolvedLoadMessagesBuildError(customLoadMessagesPath));
    } else {
      mergedConfig.loadMessagesEnabled = true;
    }
  } else {
    mergedConfig.loadMessagesEnabled = false;
  }

  // Local translations flag
  if (customLoadTranslationsPath) {
    // Check: file exists if provided
    if (!fs.existsSync(path.resolve(customLoadTranslationsPath))) {
      throw new Error(
        unresolvedLoadTranslationsBuildError(customLoadTranslationsPath)
      );
    } else {
      mergedConfig.loadTranslationsType = 'custom';
    }
  } else {
    mergedConfig.loadTranslationsType = 'remote';
  }

  // Check: projectId is not required for remote infrastructure, but warn if missing for dev, nothing for prod
  if (
    (mergedConfig.cacheUrl || mergedConfig.runtimeUrl) &&
    !mergedConfig.projectId &&
    process.env.NODE_ENV === 'development' &&
    mergedConfig.loadTranslationsType === 'remote' &&
    !mergedConfig.loadMessagesEnabled // skip warn if using local messages
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
    !(mergedConfig.apiKey || mergedConfig.devApiKey) &&
    process.env.NODE_ENV === 'development'
  ) {
    console.warn(APIKeyMissingWarn);
  }

  // Check: if using GT infrastructure, warn about unsupported locales
  const gtRuntimeTranslationEnabled =
    mergedConfig.runtimeUrl === defaultWithGTConfigProps.runtimeUrl &&
    ((process.env.NODE_ENV === 'production' && mergedConfig.apiKey) ||
      (process.env.NODE_ENV === 'development' && mergedConfig.devApiKey));
  const gtRemoteCacheEnabled =
    mergedConfig.cacheUrl === defaultWithGTConfigProps.cacheUrl &&
    mergedConfig.loadTranslationsType === 'remote';
  if (
    (gtRuntimeTranslationEnabled || gtRemoteCacheEnabled) &&
    mergedConfig.projectId
  ) {
    const warningLocales = (
      mergedConfig.locales || defaultWithGTConfigProps.locales
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
      _GENERALTRANSLATION_LOCAL_MESSAGES_ENABLED:
        mergedConfig.loadMessagesEnabled.toString(),
      _GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED: (
        mergedConfig.loadTranslationsType === 'custom'
      ).toString(),
      _GENERALTRANSLATION_DEFAULT_LOCALE: (
        mergedConfig.defaultLocale || defaultWithGTConfigProps.defaultLocale
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
                'gt-next/_load-translations': customLoadTranslationsPath || '',
                'gt-next/_load-messages': customLoadMessagesPath || '',
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
        // Disable cache in dev bc people might move around loadTranslations() and loadMessages() files
        if (process.env.NODE_ENV === 'development') {
          webpackConfig.cache = false;
        }
        if (resolvedDictionaryFilePath) {
          webpackConfig.resolve.alias['gt-next/_dictionary'] = path.resolve(
            webpackConfig.context,
            resolvedDictionaryFilePath
          );
        }
        if (customLoadTranslationsPath) {
          webpackConfig.resolve.alias[`gt-next/_load-translations`] =
            path.resolve(webpackConfig.context, customLoadTranslationsPath);
        }
        if (customLoadMessagesPath) {
          webpackConfig.resolve.alias[`gt-next/_load-messages`] = path.resolve(
            webpackConfig.context,
            customLoadMessagesPath
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
export const initGT = (props: withGTConfigProps) => (nextConfig: any) =>
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
