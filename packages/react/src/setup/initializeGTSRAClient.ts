import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import {
  initializeDictionaryManager,
  type DictionaryConfig,
} from 'gt-i18n/internal';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for client-side rendering.
 */
export function initializeGTSRAClient({
  dictionary,
  loadDictionary,
  ...config
}: ReactInitializeGTParams &
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  DictionaryConfig): void {
  const runtimeConfig = addRuntimeCredentials({
    cacheExpiryTime: null,
    ...config,
  });
  internalInitializeGTSRA(runtimeConfig);
  // shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: runtimeConfig.cacheExpiryTime,
  });
}
