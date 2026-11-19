import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for client-side rendering. Translations never expire in the
 * browser, so `cacheExpiryTime` is ignored.
 */
export function initializeGTSRAClient(config: ReactInitializeGTParams): void {
  internalInitializeGTSRA(
    addRuntimeCredentials({
      ...config,
      // Translations arrive through updateTranslations(), and an expired
      // locale would drop them.
      cacheExpiryTime: null,
    })
  );
}
