import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import {
  createOrUpdateBrowserConditionStore,
  type CreateBrowserConditionStoreParams,
} from '../condition-store/createBrowserConditionStore';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTClientParams = ReactInitializeGTParams &
  CreateBrowserConditionStoreParams;

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(config: InitializeGTClientParams): void {
  const runtimeConfig = addRuntimeCredentials({
    cacheExpiryTime: null,
    ...config,
  });
  internalInitializeGTSRA(runtimeConfig);
  createOrUpdateBrowserConditionStore(runtimeConfig);
}
