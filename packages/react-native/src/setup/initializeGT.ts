import {
  initializeReactI18nCache,
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';

export type InitializeGTParams = ReactInitializeGTParams;

/**
 * Initialize GT for React Native. The i18nCache is always created: native
 * providers load translations through it.
 */
export function initializeGT(config: InitializeGTParams): void {
  internalInitializeGTSRA(config);
  initializeReactI18nCache(config);
}
