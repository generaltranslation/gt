import { type I18nConfigParams } from '@generaltranslation/react-core/pure';
import { type NextI18nCacheParams } from '../i18n-cache/NextI18nCache';
import { resolveTranslationLoader } from '../resolvers/resolveTranslationLoader';
import { getRuntimeCredentials } from './runtimeCredentials';

export type NextSetupI18nConfigParams = I18nConfigParams & {
  cacheUrl?: string | null;
  _disableDevHotReload?: boolean;
};

// TODO: better way of communicating from build to runtime
export function getParams(): {
  i18nConfigParams: NextSetupI18nConfigParams;
  nextI18nCacheParams: NextI18nCacheParams;
} {
  // Read from build output
  const publicConfig = JSON.parse(
    process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );
  const { projectId, devApiKey, apiKey } = getRuntimeCredentials();

  // I18nConfigParams
  const i18nConfigParams: NextSetupI18nConfigParams = {
    defaultLocale: publicConfig.defaultLocale,
    locales: publicConfig.locales,
    customMapping: publicConfig.customMapping,
    runtimeUrl: publicConfig.runtimeUrl,
    projectId,
    devApiKey,
    apiKey,
    cacheUrl: privateConfig.cacheUrl,
    _disableDevHotReload: privateConfig._disableDevHotReload,
    localeCookieName: privateConfig.headersAndCookies?.localeCookieName,
    enableI18nCookieName: privateConfig.headersAndCookies?.enableI18nCookieName,
  };

  // NextI18nCacheParams
  const timeout = privateConfig.renderSettings?.timeout;
  const nextI18nCacheParams: NextI18nCacheParams = {
    apiKey,
    devApiKey,
    projectId,
    runtimeUrl: publicConfig.runtimeUrl,
    cacheUrl: privateConfig.cacheUrl,
    _versionId: privateConfig._versionId,
    cacheExpiryTime: privateConfig.cacheExpiryTime,
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
    loadTranslations: createLoadTranslations(),
  };

  return {
    i18nConfigParams,
    nextI18nCacheParams,
  };
}

function createLoadTranslations() {
  if (typeof window !== 'undefined') return;
  return resolveTranslationLoader();
}
