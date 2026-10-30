import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import {
  initializeDictionaryManager,
  type DictionaryConfig,
} from 'gt-i18n/internal';

// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export type InitializeGTParams = ReactInitializeGTParams & DictionaryConfig;

// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
/**
 * Initialize GT for React Native.
 */
export function initializeGT({
  dictionary,
  loadDictionary,
  ...config
}: InitializeGTParams): void {
  internalInitializeGTSRA(config);
  initializeDictionaryManager({
    dictionary,
    loadDictionary,
    cacheExpiryTime: config.cacheExpiryTime,
  });
}
