import {
  I18nConfigParams,
  initializeI18nConfig,
  setupGTServicesEnabled,
} from 'gt-i18n/internal';
import {
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
  setupGTServicesEnabled(gtservicesEnabledParams);
  initializeI18nConfig(i18nConfigParams);

  const i18nCache = new NextI18nCache(nextI18nCacheParams);
  setNextI18nCache(i18nCache);
}
