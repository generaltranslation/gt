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
      cacheExpiryTime: null,
      ...params.nextI18nCacheParams,
    },
  });
}
