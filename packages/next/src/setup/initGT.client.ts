import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  setTranslationsSnapshotLoader,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import { isI18nConfigInitialized } from 'gt-i18n/internal';
import { getParams } from './shared';

/**
 * Initialize GT for Next.js client entrypoints.
 */
export function initializeGTClient(
  {
    i18nConfigParams,
    i18nCacheParams,
  }: {
    i18nConfigParams: I18nConfigParams;
    i18nCacheParams: ReactI18nCacheParams;
  } = getParams()
): void {
  // Every gt-next client entry module calls this on import, so only the first call may set up GT.
  if (isI18nConfigInitialized()) return;

  const config = {
    ...i18nConfigParams,
    ...i18nCacheParams,
    /**
     * Always disable cache expiry for client-side lookups.
     * Translations are exclusively passed from server to client, so the
     * client has no loader to refresh expired entries.
     */
    cacheExpiryTime: null,
  };
  internalInitializeGTSRA(config);

  // Dev hot reload only: production client lookups read the server-provided
  // snapshots, so no client i18nCache is needed
  if (process.env.NODE_ENV !== 'production') {
    initializeReactI18nCache(config);
  } else {
    setTranslationsSnapshotLoader(config);
  }
}
