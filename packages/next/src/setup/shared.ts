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
  const clientConfig = JSON.parse(
    process.env._GENERALTRANSLATION_CLIENT_I18N_CONFIG_PARAMS || '{}'
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
    cacheUrl: clientConfig.cacheUrl,
    _disableDevHotReload: clientConfig._disableDevHotReload,
    localeCookieName: clientConfig.headersAndCookies?.localeCookieName,
    enableI18nCookieName: clientConfig.headersAndCookies?.enableI18nCookieName,
  };

  // NextI18nCacheParams
  const timeout = clientConfig.renderSettings?.timeout;
  const nextI18nCacheParams: NextI18nCacheParams = {
    apiKey,
    devApiKey,
    projectId,
    runtimeUrl: publicConfig.runtimeUrl,
    cacheUrl: clientConfig.cacheUrl,
    _versionId: clientConfig._versionId,
    cacheExpiryTime: clientConfig.cacheExpiryTime,
    // batching config
    batchConfig: {
      maxConcurrentRequests: clientConfig.maxConcurrentRequests,
      maxBatchSize: clientConfig.maxBatchSize,
      batchInterval: clientConfig.batchInterval,
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
