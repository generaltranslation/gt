import { useCallback } from 'react';
import {
  getReadonlyConditionStoreWithFallback,
  getTranslationsSnapshot,
} from '@generaltranslation/react-core/context';
import { nativeStoreSet } from '../utils/nativeStore';
import {
  getEnableI18nStoreName,
  getLocaleStoreName,
  getReloadRuntime,
} from '../setup/initializeGTSPA';

/**
 * Returns a function that sets the locale and reloads the configured runtime.
 */
export function useSetLocale() {
  return useCallback((locale: string) => {
    nativeStoreSet(getLocaleStoreName(), locale);
    getReadonlyConditionStoreWithFallback().setLocale(locale);
    void reloadRuntime();
  }, []);
}

/**
 * Returns a function that sets the enableI18n flag and reloads the configured runtime.
 */
export function useSetEnableI18n() {
  return useCallback((enableI18n: boolean) => {
    nativeStoreSet(getEnableI18nStoreName(), enableI18n ? 'true' : 'false');
    getReadonlyConditionStoreWithFallback().setEnableI18n(enableI18n);
    void reloadRuntime();
  }, []);
}

async function reloadRuntime() {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  const state = {
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  };

  await getTranslationsSnapshot(state.locale);
  await getReloadRuntime()(state);
}
