import {
  initializeI18nConfig,
  ReactI18nCache,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { getParams } from './shared';
import type { NextSetupI18nConfigParams } from './shared';
import type { NextI18nCacheParams } from '../i18n-cache/NextI18nCache';

/**
 * Initialize GT for Next.js client entrypoints.
 */
export function initializeGTClient(
  {
    i18nConfigParams,
    nextI18nCacheParams,
  }: {
    i18nConfigParams: NextSetupI18nConfigParams;
    nextI18nCacheParams: NextI18nCacheParams;
  } = getParams()
): void {
  initializeI18nConfig(i18nConfigParams);
  const i18nCache = new ReactI18nCache({
    ...nextI18nCacheParams,
    /**
     * Always disable cache expiry for client-side lookups.
     * Translations and dictionaries are exclusively passed from server to
     * client, so the client has no loader to refresh expired entries.
     */
    cacheExpiryTime: null,
  });
  setReactI18nCache(i18nCache);
}
