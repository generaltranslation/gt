import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(config: ReactInitializeGTParams): void {
  internalInitializeGTSRA(
    addRuntimeCredentials({
      cacheExpiryTime: null,
      ...config,
    })
  );
}
