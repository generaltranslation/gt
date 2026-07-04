import {
  internalInitializeGTSRA,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for server-rendered React runtimes.
 */
export function initializeGTSRA(
  config: I18nConfigParams & ReactI18nCacheParams
): void {
  internalInitializeGTSRA(addRuntimeCredentials(config));
}
