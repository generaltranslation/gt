import type { App } from 'vue';
import {
  getI18nCache,
  I18nCache,
  initializeI18nConfig,
  isI18nConfigInitialized,
  setI18nCache,
} from 'gt-i18n/internal';
import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
import {
  createConditionStore,
  getConditionStore,
  isConditionStoreInitialized,
  setConditionStore,
  type ConditionStoreOptions,
} from './condition-store';
import { invalidateTranslations } from './internal/reactivity';

export type GTOptions = I18nConfigParams &
  I18nCacheConstructorParams &
  ConditionStoreOptions;

export interface GTPlugin {
  install: (app: App) => void;
  /**
   * Resolves once translations for the initial locale are loaded.
   * Await it before mounting to avoid a flash of untranslated content:
   *
   * ```ts
   * const app = createApp(App).use(gt);
   * await gt.ready;
   * app.mount('#app');
   * ```
   *
   * Mounting earlier also works — content re-renders translated when the
   * load completes.
   */
  ready: Promise<void>;
}

/**
 * Creates the GT plugin: wires the gt-i18n singletons (config, translation
 * cache, reactive condition store) and starts loading translations for the
 * resolved locale.
 *
 * ```ts
 * import { createGT } from 'gt-vue';
 * import gtConfig from '../gt.config.json';
 *
 * const gt = createGT({
 *   ...gtConfig,
 *   loadTranslations: async (locale) =>
 *     (await import(`./_gt/${locale}.json`)).default,
 * });
 *
 * const app = createApp(App).use(gt);
 * await gt.ready;
 * app.mount('#app');
 * ```
 */
export function createGT(options: GTOptions = {}): GTPlugin {
  if (!isI18nConfigInitialized()) {
    initializeI18nConfig(options);
    setI18nCache(new I18nCache(options));
  }
  if (!isConditionStoreInitialized()) {
    setConditionStore(createConditionStore(options));
  }

  const locale = getConditionStore().getLocale();
  const ready = Promise.all([
    getI18nCache().loadTranslations(locale),
    getI18nCache().loadDictionary(locale),
  ])
    .catch(() => undefined)
    .then(() => invalidateTranslations());

  return {
    install(_app: App) {
      // Everything lives in the shared gt-i18n singletons for now; the
      // install hook is the integration point for future per-app scoping.
    },
    ready,
  };
}
