import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import { getI18nConfig } from 'gt-i18n/internal';
import type { DevCredentials } from 'gt-i18n/internal';
import { getParams } from './shared';
import type { NextSetupI18nConfigParams } from './shared';
import type { NextI18nCacheParams } from '../i18n-cache/NextI18nCache';

export type { DevCredentials };

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
  internalInitializeGTSRA({
    ...i18nConfigParams,
    ...nextI18nCacheParams,
    /**
     * Always disable cache expiry for client-side lookups.
     * Translations and dictionaries are exclusively passed from server to
     * client, so the client has no loader to refresh expired entries.
     */
    cacheExpiryTime: null,
  });
}

/**
 * Give the client the development key the RSC GTProvider passed down. App
 * Router keeps the key server-only (GT_DEV_API_KEY), so the client's
 * module-load initialization ran without it. The client singletons are
 * write-once, so this updates the existing config in place; the cache reads
 * the config on each runtime translation request.
 */
export function applyDevCredentialsClient(credentials: DevCredentials): void {
  if (process.env.NODE_ENV !== 'development') return;
  const i18nConfig = getI18nConfig();
  if (i18nConfig.isDevHotReloadEnabled()) return;
  i18nConfig.setDevCredentials(credentials);
}
