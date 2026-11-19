import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';

/**
 * Initialize GT for React Native. Translations never expire in the app, so
 * `cacheExpiryTime` is ignored.
 */
export function initializeGT(config: ReactInitializeGTParams): void {
  internalInitializeGTSRA({
    ...config,
    // The provider loads a locale once, so the cache has to keep it.
    cacheExpiryTime: null,
  });
}
