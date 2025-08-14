import path from 'path';
import fs from 'fs';
import { NextConfig } from 'next';
import defaultWithGTConfigProps, {
  defaultCacheExpiryTime,
} from './config-dir/props/defaultWithGTConfigProps';
import withGTConfigProps from './config-dir/props/withGTConfigProps';
import {
  APIKeyMissingWarn,
  conflictingConfigurationBuildError,
  createUnsupportedLocalesWarning,
  devApiKeyIncludedInProductionError,
  projectIdMissingWarn,
  standardizedLocalesWarning,
  unresolvedLoadDictionaryBuildError,
  unresolvedLoadTranslationsBuildError,
  unsupportedGetLocalePathBuildError,
} from './errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import { getLocaleProperties, standardizeLocale } from 'generaltranslation';
import { turboConfigStable } from './plugin/getTurboConfigStable';

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
 * @param {number} [cacheExpiryTime] - The time in milliseconds for how long translations should be cached.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {boolean} [ignoreBrowserLocales=defaultWithGTConfigProps.ignoreBrowserLocales] - Whether to ignore browser's preferred locales.
 * @param {object} headersAndCookies - Additional headers and cookies that can be passed for extended configuration.
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
  const envApiKey: string | undefined =
    process.env.NODE_ENV === 'production'
      ? process.env.GT_API_KEY
      : process.env.GT_DEV_API_KEY || process.env.GT_API_KEY;
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

  // ---------- CHECK FOR CONFIG CONFLICTS ---------- //

  // Check for conflicts between config and params
  const conflicts = Object.entries(loadedConfig)
    .filter(([key, value]) => {
      // Skip if key doesn't exist in props
      if (!(key in props)) return false;

      const propValue = props[key];

      // Handle null/undefined values
      if (value == null || propValue == null) {
        return value !== propValue;
      }

      // Handle primitive types (string, number, boolean)
      if (typeof value !== 'object') {
        return value !== propValue;
      }

      // Handle arrays (no need for deep equality check)
      if (Array.isArray(value)) {
        if (!Array.isArray(propValue)) return true;
        if (value.length !== propValue.length) return true;
        return value.some((v, i) => v !== propValue[i]);
      }

      // Handle objects
      if (typeof value === 'object' && typeof propValue === 'object') {
        const valueKeys = Object.keys(value);
        const propKeys = Object.keys(propValue);
        const keys = new Set([...valueKeys, ...propKeys]);

        // Objects must match exactly (no need to go deeper)
        if (valueKeys.length !== propKeys.length) return true;
        return !Array.from(keys).every((k) => value[k] === propValue[k]);
      }

      return false;
    })
    .map(
      ([key, value]) =>
        `- Key: ${key} Next Config: ${JSON.stringify(props[key])} does not match GT Config: ${JSON.stringify(value)}`
    );

  if (conflicts.length) {
    throw new Error(conflictingConfigurationBuildError(conflicts));
  }

  // Validate getLocalePath
  if (props.getLocalePath) {
    throw new Error(unsupportedGetLocalePathBuildError);
  }

  // Check if experimentalSwcPluginOptions is enabled
  const enableExperimentalSwcPlugin =
    Object.keys(props.experimentalSwcPluginOptions || {}).length > 0;
  const enableSwcPlugin =
    enableExperimentalSwcPlugin || nextConfig.experimental?.swcPlugins;

  // ---------- MERGE CONFIGS ---------- //

  // Merge cookie and header names
  const mergedHeadersAndCookies = {
    ...defaultWithGTConfigProps.headersAndCookies,
    ...props.headersAndCookies,
  };

  // precedence: input > env > config file > defaults
  const mergedConfig: withGTConfigProps = {
    ...defaultWithGTConfigProps,
    ...loadedConfig,
    ...envConfig,
    ...props,
    headersAndCookies: mergedHeadersAndCookies,
    _usingPlugin: true, // flag to indicate plugin usage
  };

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
      ['.json']
    );

    // Check [defaultLanguageCode].json file
    if (!resolvedDictionaryFilePath) {
      const defaultLanguage = getLocaleProperties(
        mergedConfig.defaultLocale
      )?.languageCode;

      if (defaultLanguage && defaultLanguage !== mergedConfig.defaultLocale) {
        resolvedDictionaryFilePath = resolveConfigFilepath(defaultLanguage, [
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

  // Resolve custom dictionary loader path
  const customLoadDictionaryPath =
    typeof mergedConfig.loadDictionaryPath === 'string'
      ? mergedConfig.loadDictionaryPath
      : resolveConfigFilepath('loadDictionary');

  // Resolve custom translation loader path
  const customLoadTranslationsPath =
    typeof mergedConfig.loadTranslationsPath === 'string'
      ? mergedConfig.loadTranslationsPath
      : resolveConfigFilepath('loadTranslations');

  // ----------- LOCALE STANDARDIZATION ----------- //

  // Check if using Services
  const gtRuntimeTranslationEnabled = !!(
    mergedConfig.runtimeUrl === defaultWithGTConfigProps.runtimeUrl &&
    ((process.env.NODE_ENV === 'production' && mergedConfig.apiKey) ||
      (process.env.NODE_ENV === 'development' && mergedConfig.devApiKey))
  );
  const gtRemoteCacheEnabled = !!(
    mergedConfig.cacheUrl === defaultWithGTConfigProps.cacheUrl &&
    mergedConfig.loadTranslationsType === 'remote'
  );
  const gtServicesEnabled = !!(
    (gtRuntimeTranslationEnabled || gtRemoteCacheEnabled) &&
    mergedConfig.projectId
  );

  // Standardize locales
  if (mergedConfig.locales && mergedConfig.defaultLocale) {
    mergedConfig.locales.unshift(mergedConfig.defaultLocale);
  }
  const updatedLocales: string[] = [];
  mergedConfig.locales = Array.from(new Set(mergedConfig.locales)).map(
    (locale) => {
      const updatedLocale = gtServicesEnabled
        ? standardizeLocale(locale)
        : locale;
      if (updatedLocale !== locale) {
        updatedLocales.push(`${locale} -> ${updatedLocale}`);
      }
      return updatedLocale;
    }
  );

  // ---------- DERIVED CONFIG ATTRIBUTES ---------- //

  // Local dictionary flag
  if (customLoadDictionaryPath) {
    // Check: file exists if provided
    if (!fs.existsSync(path.resolve(customLoadDictionaryPath))) {
      throw new Error(
        unresolvedLoadDictionaryBuildError(customLoadDictionaryPath)
      );
    } else {
      mergedConfig.loadDictionaryEnabled = true;
    }
  } else {
    mergedConfig.loadDictionaryEnabled = false;
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

  // Set default cache expiry if and only if no dev key
  if (
    mergedConfig.loadTranslationsType == 'remote' &&
    !mergedConfig.devApiKey &&
    typeof mergedConfig.cacheExpiryTime === 'undefined'
  ) {
    mergedConfig.cacheExpiryTime = defaultCacheExpiryTime;
  }

  // ---------- ERROR CHECKS ---------- //

  // Resolve getLocale path
  const customLocaleEnabled = false;

  // Check: projectId is not required for remote infrastructure, but warn if missing for dev, nothing for prod
  if (
    (mergedConfig.cacheUrl || mergedConfig.runtimeUrl) &&
    !mergedConfig.projectId &&
    process.env.NODE_ENV === 'development' &&
    mergedConfig.loadTranslationsType === 'remote' &&
    !mergedConfig.loadDictionaryEnabled // skip warn if using local dictionary
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
  if (gtServicesEnabled) {
    // Warn about standardized locales
    if (updatedLocales.length) {
      console.warn(standardizedLocalesWarning(updatedLocales));
    }

    // Warn about unsupported locales
    const warningLocales = (
      mergedConfig.locales || defaultWithGTConfigProps.locales
    ).filter((locale) => !getSupportedLocale(locale));
    if (warningLocales.length) {
      console.warn(createUnsupportedLocalesWarning(warningLocales));
    }
  }

  // ---------- STORE CONFIGURATIONS ---------- //
  const turboPackEnabled = process.env.TURBOPACK === '1';
  const I18NConfigParams = JSON.stringify(mergedConfig);

  const turboAliases = {
    'gt-next/_dictionary': resolvedDictionaryFilePath || '',
    'gt-next/_load-translations': customLoadTranslationsPath || '',
    'gt-next/_load-dictionary': customLoadDictionaryPath || '',
  };

  // experimental.turbo is deprecated in next@15.3.0.
  // Check for experimental.turbo. If we write to turbopack field, experimental fields will be ignored.
  // Yet, if there are other resolveAlias fields, we don't want to be ignored either.
  const experimentalTurbopack = !(
    turboConfigStable &&
    (!nextConfig.experimental?.turbo || nextConfig.turbopack?.resolveAlias)
  );

  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams,
      ...(resolvedDictionaryFilePathType && {
        _GENERALTRANSLATION_DICTIONARY_FILE_TYPE:
          resolvedDictionaryFilePathType,
      }),
      _GENERALTRANSLATION_LOCAL_DICTIONARY_ENABLED:
        mergedConfig.loadDictionaryEnabled.toString(),
      _GENERALTRANSLATION_LOCAL_TRANSLATION_ENABLED: (
        mergedConfig.loadTranslationsType === 'custom'
      ).toString(),
      _GENERALTRANSLATION_DEFAULT_LOCALE: (
        mergedConfig.defaultLocale || defaultWithGTConfigProps.defaultLocale
      ).toString(),
      _GENERALTRANSLATION_GT_SERVICES_ENABLED: gtServicesEnabled.toString(),
      _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES:
        mergedConfig.ignoreBrowserLocales?.toString() ||
        defaultWithGTConfigProps.ignoreBrowserLocales.toString(),
      _GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED:
        customLocaleEnabled.toString(),
    },
    ...(turboPackEnabled &&
      !experimentalTurbopack && {
        turbopack: {
          ...nextConfig.turbopack,
          resolveAlias: {
            ...nextConfig.turbopack?.resolveAlias,
            ...turboAliases,
          },
        },
      }),
    experimental: {
      ...nextConfig.experimental,
      // SWC Plugin
      ...(enableSwcPlugin && {
        swcPlugins: [
          ...(nextConfig.experimental?.swcPlugins || []),
          enableExperimentalSwcPlugin && [
            path.resolve(__dirname, './gt_swc_plugin.wasm'),
            {
              ...mergedConfig.experimentalSwcPluginOptions,
            },
          ],
        ],
      }),
      ...(turboPackEnabled &&
        experimentalTurbopack && {
          turbo: {
            ...nextConfig.experimental?.turbo,
            resolveAlias: {
              ...nextConfig.experimental?.turbo?.resolveAlias,
              ...turboAliases,
            },
          },
        }),
    },
    webpack: function webpack(
      ...[webpackConfig, options]: Parameters<
        NonNullable<NextConfig['webpack']>
      >
    ) {
      // Only apply webpack aliases if we're using webpack (not Turbopack)
      if (!turboPackEnabled) {
        // Disable cache in dev bc people might move around loadTranslations() and loadDictionary() files
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
        if (customLoadDictionaryPath) {
          webpackConfig.resolve.alias[`gt-next/_load-dictionary`] =
            path.resolve(webpackConfig.context, customLoadDictionaryPath);
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
