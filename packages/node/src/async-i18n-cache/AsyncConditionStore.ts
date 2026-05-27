import { AsyncLocalStorage } from 'node:async_hooks';
import type { ScopedConditionStore } from 'gt-i18n/internal/types';
import { getI18nConfig } from 'gt-i18n/internal';

type Store = {
  locale: string;
  enableI18n?: boolean;
};

const OUTSIDE_SCOPE_MESSAGE =
  'AsyncConditionStore: getLocale() called outside of a withGT() scope.';

const ENABLE_I18N_MESSAGE =
  'AsyncConditionStore: getEnableI18n() called outside of a withGT() scope.';

type AsyncConditionStoreConstructorParams = {
  store?: AsyncLocalStorage<Store>;
};

/**
 * Condition store implementation that uses AsyncLocalStorage.
 */
export class AsyncConditionStore implements ScopedConditionStore {
  private store: AsyncLocalStorage<Store>;

  constructor({ store }: AsyncConditionStoreConstructorParams = {}) {
    this.store = store ?? new AsyncLocalStorage();
  }

  /**
   * TODO: should this be a static function
   * */
  run<T>(locale: string, callback: () => T): T {
    return this.store.run({ locale: resolveLocale(locale) }, callback);
  }

  getLocale(): string {
    const store = this.store.getStore();
    if (!store) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(OUTSIDE_SCOPE_MESSAGE);
        return resolveLocale();
      }
      throw new Error(OUTSIDE_SCOPE_MESSAGE);
    }
    return resolveLocale(store.locale);
  }

  /**
   * TODO: implement
   */
  getEnableI18n(): boolean {
    const store = this.store.getStore();
    if (!store) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(ENABLE_I18N_MESSAGE);
        return true;
      }
      throw new Error(ENABLE_I18N_MESSAGE);
    }
    return store.enableI18n ?? true;
  }
}

function resolveLocale(locale?: string): string {
  const i18nConfig = getI18nConfig();
  return i18nConfig.determineLocale(locale) || i18nConfig.getDefaultLocale();
}
