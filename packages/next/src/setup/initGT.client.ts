import {
  internalInitializeGTSRA,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
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
  internalInitializeGTSRA({
    ...i18nConfigParams,
    ...i18nCacheParams,
    /**
     * Always disable cache expiry for client-side lookups.
     * Translations are exclusively passed from server to client, so the
     * client has no loader to refresh expired entries.
     */
    cacheExpiryTime: null,
  });
}
