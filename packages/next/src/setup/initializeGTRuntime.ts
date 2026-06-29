import { initializeGT as coreInitializeGT } from './initGT';
import { getParams } from './shared';

/**
 * Initialize GT for Next.js runtime entrypoints.
 */
export function initializeGTRuntime(): void {
  const params = getParams();

  coreInitializeGT({
    ...params,
    nextI18nCacheParams: {
      ...(isBrowser() && { cacheExpiryTime: null }),
      ...params.nextI18nCacheParams,
    },
  });
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}
