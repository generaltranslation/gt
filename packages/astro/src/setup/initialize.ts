import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import { isI18nConfigInitialized } from 'gt-i18n/internal';
import type { InitializeGTAstroParams } from '../types';
import { AsyncConditionStore } from '../condition-store/AsyncConditionStore';
import {
  isAsyncConditionStoreInitialized,
  setAsyncConditionStore,
} from '../condition-store/singleton-operations';

/**
 * Initializes the server-side GT runtime: i18n config, translation cache, and
 * the AsyncLocalStorage-backed condition store that scopes a locale to each
 * request. Idempotent so dev-server module reloads don't warn.
 */
export function initializeGTAstro(config: InitializeGTAstroParams): void {
  if (!isI18nConfigInitialized()) {
    internalInitializeGTSRA(config);
  }
  if (!isAsyncConditionStoreInitialized()) {
    setAsyncConditionStore(new AsyncConditionStore());
  }
}
