import {
  initializeI18nConfig,
  ReactI18nCache,
  setReactI18nCache,
  type I18nConfigParams,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
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
  initializeI18nConfig(i18nConfigParams);

  const i18nCache = new ReactI18nCache(i18nCacheParams);
  setReactI18nCache(i18nCache);
}
