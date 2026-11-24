import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for server-rendered React runtimes.
 */
export function initializeGTSRA(config: ReactInitializeGTParams): void {
  const runtimeConfig = addRuntimeCredentials(config);
  internalInitializeGTSRA(runtimeConfig);
  initializeReactI18nCache(runtimeConfig);
}
