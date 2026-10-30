import {
  getTranslationsSnapshot,
  I18nStore,
  setI18nStore,
  setReactI18nCache,
  getReadonlyConditionStore,
  initializeI18nConfig,
} from '@generaltranslation/react-core/pure';
import {
  getLocaleTwinCacheParams,
  initializeLocaleTwins,
} from '@generaltranslation/react-core/internal/experimental';
import type { GTConfig } from 'generaltranslation/types';
import { BrowserI18nCache } from '../../i18n-cache/BrowserI18nCache';
import type { InitializeGTSPAParams as RegularInitializeGTSPAParams } from '../../setup/initializeGTSPA';
import { addRuntimeCredentials } from '../../setup/runtimeCredentials';
import { createOrUpdateBrowserConditionStore } from '../condition-store/createBrowserConditionStore';

export type InitializeGTSPAParams = RegularInitializeGTSPAParams &
  Pick<GTConfig, 'experimental'>;

/**
 * `initializeGTSPA()` with locale twins (`experimental.splitting:
 * "locale-twins"`): in production the translations come from the locale
 * twins, so the cache loads nothing and nothing blocks on a whole locale.
 * `vite dev` serves no twins and loads translations as usual.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  const runtimeConfig = addRuntimeCredentials(config);
  initializeI18nConfig(runtimeConfig, 'SPA');
  initializeLocaleTwins(runtimeConfig);

  setReactI18nCache(
    new BrowserI18nCache(getLocaleTwinCacheParams(runtimeConfig))
  );

  createOrUpdateBrowserConditionStore(runtimeConfig);

  setI18nStore(new I18nStore());

  // Loads nothing on a locale twin client (unless dictionaries need it)
  await getTranslationsSnapshot(getReadonlyConditionStore().getLocale());
}
