import { type I18nConfigParams, initializeI18nConfig, setupGTServicesEnabled } from "gt-i18n/internal";
import { NextI18nCache, type NextI18nCacheParams, setNextI18nCache } from "../i18n-cache/NextI18nCache";
import type { GTServicesEnabledParams } from "gt-i18n/internal/types";
import { loadTranslations } from "../config-dir/loadTranslation";

/**
 * Initialize GT for Next.js
 */
export function initializeGT(): void {
  const {
    i18nConfigParams,
    gtservicesEnabledParams,
    nextI18nCacheParams,
  } = getParams();
  setupGTServicesEnabled(gtservicesEnabledParams);
  initializeI18nConfig(i18nConfigParams);

  const i18nCache = new NextI18nCache(nextI18nCacheParams);
  setNextI18nCache(i18nCache);
}

// TODO: better way of communicating from build to runtime
function getParams(): {
  i18nConfigParams: I18nConfigParams;
  gtservicesEnabledParams: GTServicesEnabledParams;
  nextI18nCacheParams: NextI18nCacheParams;
} {
  // Read from build output
  const publicConfig = JSON.parse(process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}');
  const privateConfig = JSON.parse(process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}');
  const projectId = process.env.NEXT_PUBLIC_GT_PROJECT_ID;
  const devApiKey = process.env.NEXT_PUBLIC_GT_DEV_API_KEY;
  const apiKey = process.env.GT_API_KEY;

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
      }
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
    return (await loadTranslations({
      targetLocale: locale,
      ...(cacheUrl && { cacheUrl }),
      ...(projectId && { projectId }),
      ...(_versionId && { _versionId }),
    })) || {};
  }
}