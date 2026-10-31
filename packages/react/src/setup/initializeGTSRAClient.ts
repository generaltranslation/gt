import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTClientParams = ReactInitializeGTParams;

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(config: InitializeGTClientParams): void {
  const runtimeConfig = addRuntimeCredentials({
    cacheExpiryTime: null,
    ...config,
  });
  internalInitializeGTSRA(runtimeConfig);

  // Dev hot reload only: production client lookups read the provider's
  // snapshots, so no client i18nCache is needed
  if (process.env.NODE_ENV !== 'production') {
    initializeReactI18nCache(runtimeConfig);
  }
}
