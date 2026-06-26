import { type I18nConfigParams } from 'gt-i18n/internal';
import { type NextI18nCacheParams } from '../i18n-cache/NextI18nCache';
import type { GTServicesEnabledParams } from 'gt-i18n/internal/types';
import { loadTranslations } from '../config-dir/loadTranslation';
import { getRuntimeCredentials } from './runtimeCredentials';

type PublicI18nConfigParams = Omit<
  I18nConfigParams,
  'projectId' | 'devApiKey' | 'apiKey'
>;

type PublicI18nConfigModule =
  | PublicI18nConfigParams
  | {
      default?: PublicI18nConfigParams;
      publicConfig?: PublicI18nConfigParams;
    };

// TODO: better way of communicating from build to runtime
export function getParams(): {
  i18nConfigParams: I18nConfigParams;
  gtservicesEnabledParams: GTServicesEnabledParams;
  nextI18nCacheParams: NextI18nCacheParams;
} {
  // Read from build output
  const publicConfig = getPublicConfigParams();
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );
  const { projectId, devApiKey, apiKey } = getRuntimeCredentials();

  // I18nConfigParams
  const i18nConfigParams: I18nConfigParams = {
    defaultLocale: publicConfig.defaultLocale,
    locales: publicConfig.locales,
    customMapping: publicConfig.customMapping,
    runtimeUrl: publicConfig.runtimeUrl,
    projectId,
    devApiKey,
    apiKey,
  };

  // GTServicesEnabledParams
  const gtservicesEnabledParams: GTServicesEnabledParams = {
    projectId,
    devApiKey,
    apiKey,
    runtimeUrl: publicConfig.runtimeUrl,
    cacheUrl: privateConfig.cacheUrl,
  };

  // NextI18nCacheParams
  const timeout = privateConfig.renderSettings?.timeout;
  const nextI18nCacheParams: NextI18nCacheParams = {
    apiKey,
    devApiKey,
    projectId,
    runtimeUrl: publicConfig.runtimeUrl,
    cacheUrl: privateConfig.cacheUrl,
    // batching config
    batchConfig: {
      maxConcurrentRequests: privateConfig.maxConcurrentRequests,
      maxBatchSize: privateConfig.maxBatchSize,
      batchInterval: privateConfig.batchInterval,
    },
    // runtime translation config
    runtimeTranslation: {
      // TODO: reduce redundancy in this config
      timeout,
      metadata: {
        sourceLocale: publicConfig.defaultLocale,
        timeout,
        projectId,
        publish: true,
        fast: true,
      },
    },
    // loader
    loadTranslations: createLoadTranslations({
      cacheUrl: privateConfig.cacheUrl,
      projectId,
      _versionId: privateConfig._versionId,
    }),
  };

  return {
    i18nConfigParams,
    gtservicesEnabledParams,
    nextI18nCacheParams,
  };
}

function getPublicConfigParams(): PublicI18nConfigParams {
  const moduleConfig = getPublicConfigModuleParams();
  if (hasPublicConfigParams(moduleConfig)) return moduleConfig;

  return JSON.parse(
    process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );
}

function getPublicConfigModuleParams(): PublicI18nConfigParams {
  let configModule: PublicI18nConfigModule | undefined;
  try {
    configModule =
      typeof window === 'undefined'
        ? require('gt-next/_server-config')
        : require('gt-next/_client-config');
  } catch {
    // No generated config module was found. Fall back to env below.
  }

  const config: unknown =
    configModule &&
    'default' in configModule &&
    typeof configModule.default === 'object'
      ? configModule.default
      : configModule &&
          'publicConfig' in configModule &&
          typeof configModule.publicConfig === 'object'
        ? configModule.publicConfig
        : configModule;

  return config && typeof config === 'object'
    ? (config as PublicI18nConfigParams)
    : {};
}

function hasPublicConfigParams(
  config: PublicI18nConfigParams
): config is Required<Pick<PublicI18nConfigParams, 'defaultLocale'>> &
  PublicI18nConfigParams {
  return typeof config.defaultLocale === 'string';
}

function createLoadTranslations({
  cacheUrl,
  projectId,
  _versionId,
}: {
  cacheUrl: string | undefined;
  projectId: string | undefined;
  _versionId: string | undefined;
}) {
  if (typeof window !== 'undefined') return;
  return async (locale: string) => {
    return (
      (await loadTranslations({
        targetLocale: locale,
        ...(cacheUrl && { cacheUrl }),
        ...(projectId && { projectId }),
        ...(_versionId && { _versionId }),
      })) || {}
    );
  };
}
