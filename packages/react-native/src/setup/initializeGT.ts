import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';

/**
 * Initialize GT for React Native. Translations never expire in the app, so
 * `cacheExpiryTime` is ignored.
 */
export function initializeGT(config: ReactInitializeGTParams): void {
  const runtimeConfig = {
    ...config,
    // The provider loads a locale once, so the cache has to keep it.
    cacheExpiryTime: null,
  };
  internalInitializeGTSRA(runtimeConfig);
  initializeReactI18nCache(runtimeConfig);
}
