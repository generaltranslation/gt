import { getParams } from './shared';
import type {
  NextSetupI18nConfigParams,
  PrivateI18nConfigParams,
} from './shared';
import type { NextI18nCacheParams } from '../i18n-cache/NextI18nCache';
import { initializeGT as coreInitializeGT } from './initGT';
import {
  AsyncConditionStore,
  type AsyncConditionStoreParams,
} from '../condition-store/AsyncConditionStore';
import { setAsyncConditionStore } from '../condition-store/AsyncConditionStore';
import {
  customGetLocaleUnresolvedWarning,
  customGetRegionUnresolvedWarning,
} from '../errors/createErrors';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    nextI18nCacheParams,
    privateConfig,
  }: {
    i18nConfigParams: NextSetupI18nConfigParams;
    nextI18nCacheParams: NextI18nCacheParams;
    privateConfig: PrivateI18nConfigParams;
  } = getParams()
): void {
  coreInitializeGT({
    i18nConfigParams,
    nextI18nCacheParams,
  });

  const asyncConditionStoreParams = getAsyncConditionStoreParams(privateConfig);

  // Note that this gets used by RSC, but SSR (aka 'use client' bondary on server)
  // uses context to access this condition store
  const conditionStore = new AsyncConditionStore(asyncConditionStoreParams);
  setAsyncConditionStore(conditionStore);
}

function getAsyncConditionStoreParams(
  privateConfig: PrivateI18nConfigParams
): AsyncConditionStoreParams {
  return {
    headerName: privateConfig.headersAndCookies?.localeHeaderName,
    cookieName: privateConfig.headersAndCookies?.localeCookieName,
    ignorePreferredLanguages: privateConfig.ignoreBrowserLocales,
    getLocale: resolveCustomGetter<string>(
      process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED === 'true',
      // Keep require paths static string literals so the bundler can resolve them.
      () => require('gt-next/internal/_getLocale'),
      'getLocale',
      customGetLocaleUnresolvedWarning
    ),
    getRegion: resolveCustomGetter<string | undefined>(
      process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED === 'true',
      () => require('gt-next/internal/_getRegion'),
      'getRegion',
      customGetRegionUnresolvedWarning
    ),
  };
}

/**
 * Resolve a user-provided custom getter (getLocale / getRegion) from its module,
 * accepting either a bare function export, a default export, or a named export.
 */
function resolveCustomGetter<T>(
  isEnabled: boolean,
  loadModule: () => unknown,
  memberName: string,
  unresolvedWarning: string
): (() => Promise<T>) | undefined {
  if (!isEnabled) return undefined;
  const module = loadModule();

  if (typeof module === 'function') {
    return module as () => Promise<T>;
  } else if (typeof module === 'object' && module !== null) {
    if ('default' in module && typeof module.default === 'function') {
      return module.default as () => Promise<T>;
    }
    const namedExport = (module as Record<string, unknown>)[memberName];
    if (typeof namedExport === 'function') {
      return namedExport as () => Promise<T>;
    }
  }
  console.warn(unresolvedWarning);
}
