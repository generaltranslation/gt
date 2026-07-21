import path from 'path';
import fs from 'fs';
import type { NextConfig } from 'next';
import {
  defaultWithGTConfigProps,
  defaultCacheExpiryTime,
} from './config-dir/props/defaultWithGTConfigProps';
import {
  type BaseWithGTConfigProps,
  type withGTConfigProps,
} from './config-dir/props/withGTConfigProps';
import {
  APIKeyMissingWarn,
  conflictingConfigurationBuildError,
  createBadFilepathWarning,
  createGTCompilerUnresolvedWarning,
  devApiKeyIncludedInProductionError,
  invalidCanonicalLocalesError,
  invalidLocalesError,
  projectIdMissingWarn,
  standardizedCanonicalLocalesWarning,
  standardizedLocalesWarning,
  unresolvedLoadDictionaryBuildError,
  unresolvedLoadTranslationsBuildError,
} from './errors/createErrors';
import { compilePathRegex } from './utils/pathRegex';
import {
  getLocaleProperties,
  isValidLocale,
  standardizeLocale,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import {
  rootParamStability,
  turboConfigStable,
} from './plugin/getStableNextVersionInfo';
import { validateCompiler } from './config-dir/utils/validateCompiler';
import {
  REQUEST_FUNCTION_ALIASES,
  resolveRequestFunctionPaths,
} from './config-dir/utils/resolveRequestFunctionPaths';
import { resolveConfigFilepath } from './config-dir/utils/resolveConfigFilepath';
import { cacheComponentsChecks } from './plugin/checks/cacheComponentsChecks';
import {
  cacheComponentsDevHotReloadDisabledWarning,
  cacheComponentsMissingLoadTranslationsError,
} from './errors/cacheComponents';
import { I18nConfigParams } from 'gt-i18n/internal/types';
import { getRuntimeCredentials } from './setup/runtimeCredentials';

type AutoderiveConfig = boolean | { jsx?: boolean; strings?: boolean };

type ConfigFileShape = {
  customMapping?: CustomMapping;
  files?: {
    gt?: {
      parsingFlags?: {
        autoderive?: AutoderiveConfig;
      };
    };
  };
};

type RuntimeCredentialProps = {
  apiKey?: string;
  devApiKey?: string;
  projectId?: string;
};

type InternalGTConfigProps = BaseWithGTConfigProps &
  RuntimeCredentialProps &
  ConfigFileShape & {
    loadDictionaryEnabled?: boolean;
    loadTranslationsType?: 'remote' | 'custom' | 'disabled';
    _dictionaryFileType?: string;
    _cacheComponentsEnabled?: boolean;
    _disableDevHotReload?: boolean;
  };

type WithGTConfigValue<T> =
  T extends Promise<infer U>
    ? Promise<U & NextConfig>
    : T extends PromiseLike<infer U>
      ? PromiseLike<U & NextConfig>
      : T & NextConfig;

type WithGTConfigResult<TNextConfig extends object> = TNextConfig extends (
  ...args: infer A
) => infer R
  ? (...args: A) => WithGTConfigValue<R>
  : TNextConfig & NextConfig;

function isThenable(value: unknown): value is PromiseLike<NextConfig> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/**
 * Initializes General Translation settings for a Next.js application.
 *
 * Use it in `next.config.js` to enable GT translation functionality as a plugin.
 *
 * @example
 * // In next.config.ts
 * import { withGTConfig } from 'gt-next/config';
 * import type { NextConfig } from 'next';
 *
 * const nextConfig = {
 *   reactStrictMode: true,
 * } satisfies NextConfig;
 *
 * export default withGTConfig(nextConfig, {
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en'
 * })
 *
 * @param {string|undefined} config - Optional config filepath (defaults to './gt.config.json'). If a file is found, it will be parsed for GT config variables.
 * @param {string|undefined} dictionary - Optional dictionary configuration file path. If a string is provided, it will be used as a path.
 * @param {string|null} [runtimeUrl=defaultInitGTProps.runtimeUrl] - The base URL for the GT API. Set to an empty string to disable automatic translations. Set to null to disable.
 * @param {string|null} [cacheUrl=defaultInitGTProps.cacheUrl] - The URL for cached translations. Set to null to disable.
 * @param {string[]|undefined} - Whether to use local translations.
 * @param {string[]} [locales=defaultInitGTProps.locales] - List of supported locales for the application.
 * @param {string} [defaultLocale=defaultInitGTProps.defaultLocale] - The default locale to use if none is specified.
 * @param {string|undefined} [getLocalePath="getLocale"] - The path to the custom getLocale function.
 * @param {string|undefined} [getRegionPath="getRegion"] - The path to the custom getRegion function.
 * @param {object} [renderSettings=defaultInitGTProps.renderSettings] - Render settings for how translations should be handled.
 * @param {number} [cacheExpiryTime] - The time in milliseconds for how long translations should be cached.
 * @param {number} [maxConcurrentRequests=defaultInitGTProps.maxConcurrentRequests] - Maximum number of concurrent requests allowed.
 * @param {number} [maxBatchSize=defaultInitGTProps.maxBatchSize] - Maximum translation requests in the same batch.
 * @param {number} [batchInterval=defaultInitGTProps.batchInterval] - The interval in milliseconds between batched translation requests.
 * @param {boolean} [ignoreBrowserLocales=defaultWithGTConfigProps.ignoreBrowserLocales] - Whether to ignore browser's preferred locales.
 * @param {boolean} [disableInvalidLocaleWarning=defaultWithGTConfigProps.disableInvalidLocaleWarning] - Whether to disable invalid request locale warnings.
 * @param {string|undefined} [pathRegex] - Regular expression that request pathnames must match for i18n middleware to be applied.
 * @param {object} headersAndCookies - Additional headers and cookies that can be passed for extended configuration.
 * @param {object} metadata - Additional metadata that can be passed for extended configuration.
 *
 * @param {object} nextConfig - The Next.js configuration object to extend
 * @param {withGTConfigProps} props - General Translation configuration properties
 * @returns {NextConfig} - An updated Next.js config with GT settings applied
 *
 * @throws {Error} If the project ID is missing and default URLs are used, or if the API key is required and missing from the environment.
 */
export function withGTConfig<TNextConfig extends object = NextConfig>(
  nextConfig?: TNextConfig,
  props: withGTConfigProps = {}
): WithGTConfigResult<TNextConfig> {
  // Next also accepts the `(phase, context) => config` function form. When given
  // one, call it and wrap the resolved config so `withGTConfig` composes with
  // other Next config plugins that return a config function — matching
  // `@sentry/nextjs`'s `withSentryConfig`. Without this, a function config would
  // be spread as a plain object below, silently dropping the user's config.
  if (typeof nextConfig === 'function') {
    const configFn = nextConfig as (
      phase: string,
      context: { defaultConfig: NextConfig }
    ) => NextConfig | Promise<NextConfig>;
    return ((phase: string, context: { defaultConfig: NextConfig }) => {
      const resolved = configFn(phase, context);
      return isThenable(resolved)
        ? resolved.then((resolvedConfig) => withGTConfig(resolvedConfig, props))
        : withGTConfig(resolved, props);
    }) as unknown as WithGTConfigResult<TNextConfig>;
  }

  const internalNextConfig = (nextConfig ?? {}) as unknown as NextConfig;

  // ---------- LOAD GT CONFIG FILE ---------- //

  let loadedConfig: Partial<InternalGTConfigProps> = {};
  try {
    let configPath: string | undefined;
    if (props.config) {
      configPath = props.config;
    } else if (fs.existsSync(defaultWithGTConfigProps.config)) {
      configPath = defaultWithGTConfigProps.config;
    } else if (fs.existsSync('./.gt/gt.config.json')) {
      // Support config under .gt for parity with .locadex
      configPath = './.gt/gt.config.json';
    } else if (fs.existsSync('./.locadex/gt.config.json')) {
      // Backward compatibility: support legacy .locadex directory
      configPath = './.locadex/gt.config.json';
    }
    if (typeof configPath === 'string' && fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf-8');
      loadedConfig = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading GT config file:', error);
  }

  // ---------- LOAD ENVIRONMENT VARIABLES ---------- //

  const { projectId, apiKey, devApiKey } = getRuntimeCredentials();

  // conditionally add environment variables to config
  const envConfig: Partial<InternalGTConfigProps> = {
    ...(projectId ? { projectId } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(devApiKey ? { devApiKey } : {}),
  };

  // ---------- CHECK FOR CONFIG CONFLICTS ---------- //

  // Check for conflicts between config and params
  const propsRecord = props as Record<string, unknown>;
  const conflicts = Object.entries(loadedConfig)
    .filter(([key, value]) => {
      // Skip if key doesn't exist in props
      if (!(key in props)) return false;

      const propValue = propsRecord[key];

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
        const valueRecord = value as Record<string, unknown>;
        const propRecord = propValue as Record<string, unknown>;
        const valueKeys = Object.keys(valueRecord);
        const propKeys = Object.keys(propRecord);
        const keys = new Set([...valueKeys, ...propKeys]);

        // Objects must match exactly (no need to go deeper)
        if (valueKeys.length !== propKeys.length) return true;
        return !Array.from(keys).every((k) => valueRecord[k] === propRecord[k]);
      }

      return false;
    })
    .map(
      ([key, value]) =>
        `- Key: ${key} Next Config: ${JSON.stringify(propsRecord[key])} does not match GT Config: ${JSON.stringify(value)}`
    );

  if (conflicts.length) {
    throw new Error(conflictingConfigurationBuildError(conflicts));
  }

  // ---------- MERGE CONFIGS ---------- //

  // Merge cookie and header names
  const mergedHeadersAndCookies = {
    ...defaultWithGTConfigProps.headersAndCookies,
    ...props.headersAndCookies,
  };

  // Merge compiler options
  const mergedExperimentalCompilerOptions = {
    ...defaultWithGTConfigProps.experimentalCompilerOptions,
    ...props.experimentalCompilerOptions,
  };

  // precedence: input > env > config file > defaults
  const mergedConfig: InternalGTConfigProps = {
    ...defaultWithGTConfigProps,
    ...loadedConfig,
    ...envConfig,
    ...props,
    headersAndCookies: mergedHeadersAndCookies,
    experimentalCompilerOptions: mergedExperimentalCompilerOptions,
    _usingPlugin: true, // flag to indicate plugin usage
  };

  compilePathRegex(mergedConfig.pathRegex);

  // clear up any issues with the compiler options
  validateCompiler(mergedConfig);

  // ----------- RESOLVE ANY EXTERNAL FILES ----------- //

  // Resolve wasm filepath
  const turboPackEnabled = !!process.env.TURBOPACK;
  let resolvedWasmFilePath = '';
  if (mergedConfig.experimentalCompilerOptions?.type === 'swc') {
    try {
      if (turboPackEnabled) {
        const absolutePath = path.resolve(__dirname, './gt_swc_plugin.wasm');
        resolvedWasmFilePath =
          './' + path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
      } else {
        resolvedWasmFilePath = path.resolve(__dirname, './gt_swc_plugin.wasm');
      }
    } catch (error) {
      console.error(
        createGTCompilerUnresolvedWarning('swc'),
        'Error message:',
        error
      );
      resolvedWasmFilePath = '';
      mergedConfig.experimentalCompilerOptions.type = 'none';
    }
  }

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

  // Resolve request function paths
  const requestFunctionPaths = resolveRequestFunctionPaths(mergedConfig);

  // Warn if found in /app directory
  if (
    !resolvedDictionaryFilePath &&
    resolveConfigFilepath('dictionary', ['.ts', '.js', '.json'], undefined, [
      './app',
      './src/app',
    ])
  ) {
    console.warn(
      createBadFilepathWarning('dictionary', ['./app', './src/app'])
    );
  }

  if (
    !customLoadDictionaryPath &&
    resolveConfigFilepath(
      'loadDictionary',
      ['.ts', '.js', '.json'],
      undefined,
      ['./app', './src/app']
    )
  ) {
    console.warn(
      createBadFilepathWarning('loadDictionary', ['./app', './src/app'])
    );
  }

  if (
    !customLoadTranslationsPath &&
    resolveConfigFilepath(
      'loadTranslations',
      ['.ts', '.js', '.json'],
      undefined,
      ['./app', './src/app']
    )
  ) {
    console.warn(
      createBadFilepathWarning('loadTranslations', ['./app', './src/app'])
    );
  }

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

  // Standardize canonical locales
  const updatedCanonicalLocales: string[] = [];
  if (mergedConfig.customMapping) {
    mergedConfig.customMapping = Object.fromEntries(
      Object.entries(mergedConfig.customMapping).map(([key, value]) => {
        if (typeof value !== 'object' || !('code' in value)) {
          return [key, value];
        }
        const updatedLocale = gtServicesEnabled
          ? standardizeLocale((value as { code: string }).code)
          : (value as { code: string }).code;
        if (updatedLocale !== (value as { code: string }).code) {
          updatedCanonicalLocales.push(`${key} -> ${updatedLocale}`);
        }
        return [
          key,
          {
            ...value,
            code: updatedLocale,
          },
        ];
      })
    );
  }

  // Run cache component checks
  cacheComponentsChecks({
    nextConfig: internalNextConfig,
    requestFunctionPaths,
    localTranslationsEnabled: !!customLoadTranslationsPath,
    localDictionaryEnabled: !!customLoadDictionaryPath,
  });

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

  if (internalNextConfig.cacheComponents) {
    if (mergedConfig.loadTranslationsType !== 'custom') {
      throw new Error(cacheComponentsMissingLoadTranslationsError);
    }
    if (isDevHotReloadEnabled(mergedConfig)) {
      console.warn(cacheComponentsDevHotReloadDisabledWarning);
    }
    mergedConfig._cacheComponentsEnabled = true;
    mergedConfig._disableDevHotReload = true;
    mergedConfig.cacheExpiryTime = 0;
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

  // Check: invalid locale
  if (!mergedConfig.customMapping && gtServicesEnabled) {
    const invalidLocales: string[] = [];
    mergedConfig.locales.forEach((locale) => {
      if (!isValidLocale(locale)) {
        invalidLocales.push(locale);
      }
    });
    if (invalidLocales.length) {
      throw new Error(invalidLocalesError(invalidLocales));
    }
  }

  // Check: invalid canonical locale
  if (mergedConfig.customMapping && gtServicesEnabled) {
    const invalidCanonicalLocales: string[] = [];
    mergedConfig.locales.forEach((locale) => {
      if (!isValidLocale(locale, mergedConfig.customMapping)) {
        invalidCanonicalLocales.push(locale);
      }
    });
    if (invalidCanonicalLocales.length) {
      throw new Error(invalidCanonicalLocalesError(invalidCanonicalLocales));
    }
  }

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

    // Warn about standardized canonical locales
    if (updatedCanonicalLocales.length) {
      console.warn(
        standardizedCanonicalLocalesWarning(updatedCanonicalLocales)
      );
    }
  }

  // ---------- STORE CONFIGURATIONS ---------- //
  const {
    projectId: _projectId,
    apiKey: _apiKey,
    devApiKey: _devApiKey,
    ...privateConfigParams
  } = mergedConfig;
  const I18NConfigParams = JSON.stringify(privateConfigParams);
  const publicI18NConfigParams: Omit<
    I18nConfigParams,
    'projectId' | 'devApiKey' | 'apiKey'
  > = {
    defaultLocale: mergedConfig.defaultLocale,
    locales: mergedConfig.locales,
    customMapping: mergedConfig.customMapping,
    runtimeUrl: mergedConfig.runtimeUrl,
  };

  const { type: _type, ...compilerOptions } =
    mergedConfig.experimentalCompilerOptions || {};

  // Read autoderive from parsingFlags (single source of truth shared with CLI)
  const rawAutoderive: boolean | { jsx?: boolean; strings?: boolean } =
    loadedConfig?.files?.gt?.parsingFlags?.autoderive ?? false;
  const autoderiveJsx =
    typeof rawAutoderive === 'boolean'
      ? rawAutoderive
      : (rawAutoderive.jsx ?? false);
  const autoderiveStrings =
    typeof rawAutoderive === 'boolean'
      ? rawAutoderive
      : (rawAutoderive.strings ?? false);

  const swcPluginOptions: Record<string, unknown> = {
    ...compilerOptions,
    autoderiveJsx,
    autoderiveStrings,
  };

  const swcPluginEntry: [string, Record<string, unknown>] | null =
    mergedConfig.experimentalCompilerOptions?.type === 'swc'
      ? [resolvedWasmFilePath, swcPluginOptions]
      : null;

  const turboAliases = {
    'gt-next/internal/_dictionary': resolvedDictionaryFilePath || '',
    'gt-next/internal/_load-translations': customLoadTranslationsPath || '',
    'gt-next/internal/_load-dictionary': customLoadDictionaryPath || '',
    ...Object.fromEntries(
      Object.entries(requestFunctionPaths).map(([functionName, path]) => {
        return [
          REQUEST_FUNCTION_ALIASES[
            functionName as keyof typeof REQUEST_FUNCTION_ALIASES
          ],
          path,
        ];
      })
    ),
  };

  // experimental.turbo is deprecated in next@15.3.0.
  // Check for experimental.turbo. If we write to turbopack field, experimental fields will be ignored.
  // Yet, if there are other resolveAlias fields, we don't want to be ignored either.
  const experimentalTurbopack = !(
    turboConfigStable &&
    (!internalNextConfig.experimental?.turbo ||
      internalNextConfig.turbopack?.resolveAlias)
  );

  const config: NextConfig = {
    ...internalNextConfig,
    transpilePackages: Array.from(
      new Set([...(internalNextConfig.transpilePackages || []), 'gt-next'])
    ),
    env: {
      ...internalNextConfig.env,
      _GENERALTRANSLATION_I18N_CONFIG_PARAMS: I18NConfigParams,
      NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify(
        publicI18NConfigParams
      ),
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
        mergedConfig.defaultLocale ||
        defaultWithGTConfigProps.defaultLocale ||
        ''
      ).toString(),
      _GENERALTRANSLATION_GT_SERVICES_ENABLED: gtServicesEnabled.toString(),
      _GENERALTRANSLATION_IGNORE_BROWSER_LOCALES:
        mergedConfig.ignoreBrowserLocales?.toString() ||
        defaultWithGTConfigProps.ignoreBrowserLocales?.toString() ||
        'false',
      _GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED:
        requestFunctionPaths.getLocale ? 'true' : 'false',
      _GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED:
        requestFunctionPaths.getRegion ? 'true' : 'false',
      _GENERALTRANSLATION_DISABLE_INVALID_LOCALE_WARNING:
        mergedConfig.disableInvalidLocaleWarning?.toString() || 'false',
      // nextConfig.env intentionally makes this available to client-boundary.tsx.
      ...(mergedConfig.pathRegex !== undefined && {
        _GENERALTRANSLATION_PATH_REGEX: mergedConfig.pathRegex,
      }),
    },
    ...(turboPackEnabled &&
      !experimentalTurbopack && {
        turbopack: {
          ...internalNextConfig.turbopack,
          resolveAlias: {
            ...internalNextConfig.turbopack?.resolveAlias,
            ...turboAliases,
          },
        },
      }),
    experimental: {
      ...internalNextConfig.experimental,
      ...(rootParamStability === 'experimental' && {
        rootParams: true,
      }),
      swcPlugins: [
        ...(internalNextConfig.experimental?.swcPlugins || []),
        ...(swcPluginEntry ? [swcPluginEntry] : []),
      ],
      ...(turboPackEnabled &&
        experimentalTurbopack && {
          turbo: {
            ...internalNextConfig.experimental?.turbo,
            resolveAlias: {
              ...internalNextConfig.experimental?.turbo?.resolveAlias,
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
        // Try to load GT compiler if available
        if (mergedConfig.experimentalCompilerOptions?.type === 'babel') {
          try {
            const {
              webpack: gtUnplugin,
            } = require('@generaltranslation/compiler');
            webpackConfig.plugins.unshift(
              gtUnplugin({
                ...mergedConfig.experimentalCompilerOptions,
                autoJsxImportSource: 'gt-next',
              })
            );
          } catch (e) {
            mergedConfig.experimentalCompilerOptions.type = 'none';
            console.warn(
              createGTCompilerUnresolvedWarning('babel'),
              'Error message:',
              e
            );
          }
        }

        // Disable cache in dev bc people might move around loadTranslations() and loadDictionary() files
        if (process.env.NODE_ENV === 'development') {
          webpackConfig.cache = false;
        }
        if (resolvedDictionaryFilePath) {
          webpackConfig.resolve.alias['gt-next/internal/_dictionary'] =
            path.resolve(webpackConfig.context, resolvedDictionaryFilePath);
        }
        if (customLoadTranslationsPath) {
          webpackConfig.resolve.alias[`gt-next/internal/_load-translations`] =
            path.resolve(webpackConfig.context, customLoadTranslationsPath);
        }
        if (customLoadDictionaryPath) {
          webpackConfig.resolve.alias[`gt-next/internal/_load-dictionary`] =
            path.resolve(webpackConfig.context, customLoadDictionaryPath);
        }
        for (const [functionName, pathString] of Object.entries(
          requestFunctionPaths
        )) {
          const key =
            REQUEST_FUNCTION_ALIASES[
              functionName as keyof typeof REQUEST_FUNCTION_ALIASES
            ];
          webpackConfig.resolve.alias[key] = path.resolve(
            webpackConfig.context,
            pathString
          );
        }
      }
      if (typeof internalNextConfig?.webpack === 'function') {
        return internalNextConfig.webpack(webpackConfig, options);
      }
      return webpackConfig;
    },
  };
  return config as WithGTConfigResult<TNextConfig>;
}

function isDevHotReloadEnabled(config: InternalGTConfigProps): boolean {
  return (
    !!config.devApiKey &&
    !!config.projectId &&
    config.runtimeUrl !== null &&
    config.runtimeUrl !== '' &&
    process.env.NODE_ENV === 'development'
  );
}
