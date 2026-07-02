import {
  internalInitializeGTSRA,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import type { I18nConfigParams } from 'gt-i18n/internal/types';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for server-rendered React runtimes.
 */
export function initializeGTSRA(
  config: I18nConfigParams & ReactI18nCacheParams
): void {
  internalInitializeGTSRA(addRuntimeCredentials(config));
}
