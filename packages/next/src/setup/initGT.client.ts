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
 * Give the client the development credentials the RSC GTProvider passed down.
 * GT_PROJECT_ID and GT_API_KEY are not visible to client code, so the client's
 * module-load initialization ran without them (or with legacy NEXT_PUBLIC_
 * values, which the server's GT_* values outrank). The client singletons are
 * write-once, so this updates the existing config in place; the cache reads
 * the config on each runtime translation request.
 */
export function applyDevCredentialsClient(credentials: DevCredentials): void {
  if (process.env.NODE_ENV !== 'development') return;
  getI18nConfig().setDevCredentials(credentials);
}
