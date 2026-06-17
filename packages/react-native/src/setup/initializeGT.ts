import {
  initializeI18nConfig,
  setReactI18nCache,
} from '@generaltranslation/react-core/context';
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

export function initializeGT(config: InitializeGTParams): void {
  setupGTServicesEnabled(config);
  initializeI18nConfig(config, 'server-render');

  const i18nCache = new ReactI18nCache(config);
  setReactI18nCache(i18nCache);
}
