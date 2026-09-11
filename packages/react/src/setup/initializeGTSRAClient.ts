import {
  internalInitializeGTSRAClient,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTClientParams = ReactInitializeGTParams;

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(config: InitializeGTClientParams): void {
  internalInitializeGTSRAClient(
    addRuntimeCredentials({
      cacheExpiryTime: null,
      ...config,
    })
  );
}
