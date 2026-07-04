import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import {
  NextI18nCache,
  NextI18nCacheParams,
  setNextI18nCache,
} from '../i18n-cache/NextI18nCache';
import { getParams, type NextSetupI18nConfigParams } from './shared';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    nextI18nCacheParams,
  }: {
    i18nConfigParams: NextSetupI18nConfigParams;
    nextI18nCacheParams: NextI18nCacheParams;
  } = getParams()
): void {
  initializeI18nConfig(i18nConfigParams);

  const i18nCache = new NextI18nCache(nextI18nCacheParams);
  setNextI18nCache(i18nCache);
}
