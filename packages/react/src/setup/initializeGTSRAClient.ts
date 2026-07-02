import {
  internalInitializeGTSRA,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient(
  config: I18nConfigParams & ReactI18nCacheParams
): void {
  internalInitializeGTSRA(
    addRuntimeCredentials({
      cacheExpiryTime: null,
      ...config,
    })
  );
}
