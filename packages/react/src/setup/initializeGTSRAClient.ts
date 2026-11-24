import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  setTranslationsSnapshotLoader,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for client-side rendering. Translations never expire in the
 * browser, so `cacheExpiryTime` is ignored.
 */
export function initializeGTSRAClient(config: ReactInitializeGTParams): void {
  const runtimeConfig = addRuntimeCredentials({
    ...config,
    // Translations arrive through updateTranslations(), and an expired
    // locale would drop them.
    cacheExpiryTime: null,
  });
  internalInitializeGTSRA(runtimeConfig);

  // Dev hot reload only: production client lookups read the provider's
  // snapshots, so no client i18nCache is needed
  if (process.env.NODE_ENV !== 'production') {
    initializeReactI18nCache(runtimeConfig);
  } else {
    setTranslationsSnapshotLoader(runtimeConfig);
  }
}
