import {
  initializeI18nConfig,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { ReactI18nCache } from '@generaltranslation/react-core/pure';
import type { ReactI18nCacheParams } from '@generaltranslation/react-core/pure';
import { setupGTServicesEnabled } from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';

export type InitializeGTParams = I18nConfigParams &
  GTServicesEnabledParams &
  ReactI18nCacheParams;

const ReactI18nCacheWithConfig = ReactI18nCache as new (
  config: ReactI18nCacheParams
) => ReactI18nCache;

export function initializeGT(config: InitializeGTParams): void {
  setupGTServicesEnabled(config);
  initializeI18nConfig(config, 'server-render');

  const i18nCache = new ReactI18nCacheWithConfig(config);
  setReactI18nCache(i18nCache);
}
