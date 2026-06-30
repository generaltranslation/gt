import { getParams } from './shared';
import type { NextSetupI18nConfigParams } from './shared';
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
import { getLocaleResolutionParams } from '../request/resolveLocale';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    nextI18nCacheParams,
  }: {
    i18nConfigParams: NextSetupI18nConfigParams;
    nextI18nCacheParams: NextI18nCacheParams;
  } = getParams()
): void {
  coreInitializeGT({
    i18nConfigParams,
    nextI18nCacheParams,
  });

  const asyncConditionStoreParams = getAsyncConditionStoreParams();

  // Note that this gets used by RSC, but SSR (aka 'use client' bondary on server)
  // uses context to access this condition store
  const conditionStore = new AsyncConditionStore(asyncConditionStoreParams);
  setAsyncConditionStore(conditionStore);
}

function getAsyncConditionStoreParams(): AsyncConditionStoreParams {
  return {
    ...getLocaleResolutionParams(),
    getLocale: resolveGetLocale(),
    getRegion: resolveGetRegion(),
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

function resolveGetRegion(): (() => Promise<string | undefined>) | undefined {
  const isCustomGetRegionEnabled =
    process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED === 'true';
  if (!isCustomGetRegionEnabled) return undefined;
  const module: unknown = require('gt-next/internal/_getRegion');

  if (typeof module === 'function') {
    return module as () => Promise<string | undefined>;
  } else if (typeof module === 'object' && module !== null) {
    if ('default' in module && typeof module.default === 'function') {
      return module.default as () => Promise<string | undefined>;
    } else if (
      'getRegion' in module &&
      typeof module.getRegion === 'function'
    ) {
      return module.getRegion as () => Promise<string | undefined>;
    }
  }
  console.warn(customGetRegionUnresolvedWarning);
}
