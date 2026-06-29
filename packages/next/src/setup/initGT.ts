import {
  I18nConfigParams,
  initializeI18nConfig,
  isI18nConfigInitialized,
  setupGTServicesEnabled,
} from 'gt-i18n/internal';
import {
  isNextI18nCacheInitialized,
  NextI18nCache,
  NextI18nCacheParams,
  setNextI18nCache,
} from '../i18n-cache/NextI18nCache';
import { getParams } from './shared';
import { GTServicesEnabledParams } from 'gt-i18n/internal/types';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    gtservicesEnabledParams,
    nextI18nCacheParams,
  }: {
    i18nConfigParams: I18nConfigParams;
    gtservicesEnabledParams: GTServicesEnabledParams;
    nextI18nCacheParams: NextI18nCacheParams;
  } = getParams()
): void {
  const i18nConfigInitialized = isI18nConfigInitialized();
  const nextI18nCacheInitialized = isNextI18nCacheInitialized();

  if (i18nConfigInitialized && nextI18nCacheInitialized) return;

  if (!i18nConfigInitialized) {
    setupGTServicesEnabled(gtservicesEnabledParams);
    initializeI18nConfig(i18nConfigParams);
  }

  if (!nextI18nCacheInitialized) {
    const i18nCache = new NextI18nCache(nextI18nCacheParams);
    setNextI18nCache(i18nCache);
  }
}
