import { initializeGT as coreInitializeGT } from './initGT';
import { getParams } from './shared';

/**
 * Initialize GT for Next.js client entrypoints.
 */
export function initializeGTClient(): void {
  const params = getParams();

  coreInitializeGT({
    ...params,
    nextI18nCacheParams: {
      ...params.nextI18nCacheParams,
      /**
       * Always disable cache expiry for client-side lookups.
       * Translations are exclusively passed from server to client, so
       * if translations ever expire, then the client will have no way
       * to fetch new translations.
       */
      cacheExpiryTime: null,
    },
  });
}
