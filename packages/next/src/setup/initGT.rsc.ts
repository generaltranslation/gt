import { getParams } from './shared';
import type {
  I18nConfigParams,
  GTServicesEnabledParams,
} from 'gt-i18n/internal/types';
import type { NextI18nCacheParams } from '../i18n-cache/NextI18nCache';
import { initializeGT as coreInitializeGT } from './initGT';
import {
  AsyncConditionStore,
  type AsyncConditionStoreParams,
} from '../condition-store/AsyncCondtionStore';
import { setAsyncConditionStore } from '../condition-store/AsyncCondtionStore';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    gtservicesEnabledParams,
    nextI18nCacheParams,
  }: {
    i18nConfigParams: I18nConfigParams;
    gtservicesEnabledParams: GTServicesEnabledParams;
    nextI18nCacheParams: NextI18nCacheParams;
  } = getParams()
): void {
  coreInitializeGT({
    i18nConfigParams,
    gtservicesEnabledParams,
    nextI18nCacheParams,
  });

  const asyncConditionStoreParams = getAsyncConditionStoreParams();

  // Note that this gets used by RSC, but SSR (aka 'use client' bondary on server)
  // uses context to access this condition store
  const conditionStore = new AsyncConditionStore(asyncConditionStoreParams);
  setAsyncConditionStore(conditionStore);
}

function getAsyncConditionStoreParams(): AsyncConditionStoreParams {
  const privateConfig = JSON.parse(
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
  );
  return {
    headerName: privateConfig.headersAndCookies?.localeHeaderName,
    cookieName: privateConfig.headersAndCookies?.localeCookieName,
    ignorePreferredLanguages: privateConfig.ignoreBrowserLocales,
    getLocale: resolveGetLocale(),
  };
}

function resolveGetLocale(
  module: unknown = require('gt-next/internal/_getLocale')
): (() => Promise<string>) | undefined {
  const isCustomGetLocaleEnabled =
    process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true';
  if (!isCustomGetLocaleEnabled) return undefined;

  if (typeof module === 'function') {
    return module as () => Promise<string>;
  } else if (typeof module === 'object' && module !== null) {
    if ('default' in module) {
      return resolveGetLocale(module.default);
    } else if ('getLocale' in module) {
      return resolveGetLocale(module.getLocale);
    }
  }
  console.warn('Failed to resolve custom getLocale() function');
}
