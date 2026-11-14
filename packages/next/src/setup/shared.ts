import {
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import type { BaseWithGTConfigProps } from '../config-dir/props/withGTConfigProps';
import { resolveTranslationLoader } from '../resolvers/resolveTranslationLoader';
import { parseEnvConfig } from '../utils/parseEnvConfig';
import { getRuntimeCredentials } from './runtimeCredentials';

// TODO: better way of communicating from build to runtime
export function getParams(): {
  i18nConfigParams: I18nConfigParams;
  i18nCacheParams: ReactI18nCacheParams;
} {
  // Read from build output
  const clientConfig = parseEnvConfig<
    BaseWithGTConfigProps & I18nConfigParams & ReactI18nCacheParams
  >(process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS);
  const { projectId, apiKey } = getRuntimeCredentials({
    projectId: clientConfig.projectId,
  });

  // I18nConfigParams
  const i18nConfigParams: I18nConfigParams = {
    defaultLocale: clientConfig.defaultLocale,
    locales: clientConfig.locales,
    customMapping: clientConfig.customMapping,
    timeZone: clientConfig.timeZone,
    localeMatcher: clientConfig.localeMatcher,
    runtimeUrl: clientConfig.runtimeUrl,
    projectId,
    apiKey,
    cacheUrl: clientConfig.cacheUrl,
    _disableDevHotReload: clientConfig._disableDevHotReload,
    _tagIds: clientConfig._tagIds,
    localeCookieName: clientConfig.headersAndCookies?.localeCookieName,
    enableI18nCookieName: clientConfig.headersAndCookies?.enableI18nCookieName,
  };

  // ReactI18nCacheParams
  const timeout = clientConfig.renderSettings?.timeout;
  const i18nCacheParams: ReactI18nCacheParams = {
    apiKey,
    projectId,
    runtimeUrl: clientConfig.runtimeUrl,
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
      timeout,
      metadata: { sourceLocale: clientConfig.defaultLocale },
    },
    // loader
    loadTranslations: createLoadTranslations(),
  };

  return {
    i18nConfigParams,
    i18nCacheParams,
  };
}

function createLoadTranslations() {
  if (typeof window !== 'undefined') return;
  return resolveTranslationLoader();
}
