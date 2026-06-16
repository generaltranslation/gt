import {
  getTranslationsSnapshot,
  I18nStore,
  initializeI18nConfig,
  setI18nStore,
  setReactI18nCache,
} from '@generaltranslation/react-core/context';
import type {
  I18nConfigParams,
  ReactI18nCache,
  ReactI18nCacheParams,
} from '@generaltranslation/react-core/context';
import { I18nCache, setupGTServicesEnabled } from 'gt-i18n/internal';
import type { GTServicesEnabledParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import {
  createOrUpdateNativeConditionStore,
  type CreateNativeConditionStoreParams,
} from '../condition-store/createNativeConditionStore';

type ReloadState = {
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
};

type ReloadRuntime = (state: ReloadState) => void | Promise<void>;

export type InitializeGTSPAParams = I18nConfigParams &
  GTServicesEnabledParams &
  ReactI18nCacheParams &
  CreateNativeConditionStoreParams & {
    reload?: ReloadRuntime;
  };

/**
 * Initialize GT for a React Native single-page app.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  setupGTServicesEnabled(config);
  initializeI18nConfig(config, 'SPA');

  const i18nCache = new I18nCache<Translation>(config);
  setReactI18nCache(i18nCache as unknown as ReactI18nCache);

  const conditionStore = createOrUpdateNativeConditionStore(config);

  const i18nStore = new I18nStore();
  setI18nStore(i18nStore);

  await getTranslationsSnapshot(conditionStore.getLocale());
}
