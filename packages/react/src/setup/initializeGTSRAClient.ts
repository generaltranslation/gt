import {
  internalInitializeGTSRA,
  internalInitializeStaticGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTClientParams = ReactInitializeGTParams;

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(config: InitializeGTClientParams): void {
  const initialize =
    process.env.NODE_ENV === 'production'
      ? internalInitializeStaticGTSRA
      : internalInitializeGTSRA;
  initialize(
    addRuntimeCredentials({
      cacheExpiryTime: null,
      ...config,
    })
  );
}
