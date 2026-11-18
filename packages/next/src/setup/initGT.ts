import {
  initializeI18nConfig,
  ReactI18nCache,
  setReactI18nCache,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
import { isI18nConfigInitialized } from 'gt-i18n/internal';
import { getParams } from './shared';

/**
 * Initialize GT for Next.js
 */
export function initializeGT(
  {
    i18nConfigParams,
    i18nCacheParams,
  }: {
    i18nConfigParams: I18nConfigParams;
    i18nCacheParams: ReactI18nCacheParams;
  } = getParams()
): void {
  // Every gt-next entry module calls this on import, so only the first call may set up GT.
  if (isI18nConfigInitialized()) return;

  initializeI18nConfig(i18nConfigParams);

  const i18nCache = new ReactI18nCache(i18nCacheParams);
  setReactI18nCache(i18nCache);
}
