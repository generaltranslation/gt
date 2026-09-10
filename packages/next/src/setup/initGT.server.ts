import { getParams } from './shared';
import type { NextSetupI18nConfigParams } from './shared';
import type { NextI18nCacheParams } from '../i18n-cache/NextI18nCache';
import { initializeGT as coreInitializeGT } from './initGT';

/**
 * Initialize GT for Next.js
 *
 * Request conditions are resolved directly from Next's request-scoped APIs.
 */
export function initializeGTServer(
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
}
