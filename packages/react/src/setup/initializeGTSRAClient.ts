import {
  internalInitializeGTSRA,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(
  config: I18nConfigParams & GTServicesEnabledParams & ReactI18nCacheParams
): void {
  internalInitializeGTSRA({
    cacheExpiryTime: null,
    ...config,
  });
}
