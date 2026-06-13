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
import { customGetLocaleUnresolvedWarning } from '../errors/createErrors';

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

function resolveGetLocale(): (() => Promise<string>) | undefined {
  const isCustomGetLocaleEnabled =
    process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true';
  if (!isCustomGetLocaleEnabled) return undefined;
  const module: unknown = require('gt-next/internal/_getLocale');

  if (typeof module === 'function') {
    return module as () => Promise<string>;
  } else if (typeof module === 'object' && module !== null) {
    if ('default' in module && typeof module.default === 'function') {
      return module.default as () => Promise<string>;
    } else if (
      'getLocale' in module &&
      typeof module.getLocale === 'function'
    ) {
      return module.getLocale as () => Promise<string>;
    }
  }
  console.warn(customGetLocaleUnresolvedWarning);
}
