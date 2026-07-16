import { AsyncLocalStorage } from 'node:async_hooks';
import type { ScopedConditionStoreInterface } from 'gt-i18n/internal/types';
import { getI18nConfig } from 'gt-i18n/internal';

export type AsyncConditionStoreRunParams = {
  locale: string;
  region?: string;
  enableI18n?: boolean;
};

type Store = AsyncConditionStoreRunParams;

const OUTSIDE_SCOPE_MESSAGE =
  'AsyncConditionStore: getLocale() called outside of a withGT() scope.';

const REGION_MESSAGE =
  'AsyncConditionStore: getRegion() called outside of a withGT() scope.';

const ENABLE_I18N_MESSAGE =
  'AsyncConditionStore: getEnableI18n() called outside of a withGT() scope.';

type AsyncConditionStoreConstructorParams = {
  store?: AsyncLocalStorage<Store>;
};

/**
 * Condition store implementation that uses AsyncLocalStorage.
 */
export class AsyncConditionStore implements ScopedConditionStoreInterface {
  private store: AsyncLocalStorage<Store>;

  constructor({ store }: AsyncConditionStoreConstructorParams = {}) {
    this.store = store ?? new AsyncLocalStorage();
  }

  /**
   * TODO: should this be a static function
   * */
  run<T>(
    conditions: string | AsyncConditionStoreRunParams,
    callback: () => T
  ): T {
    const { locale, region, enableI18n } =
      typeof conditions === 'string' ? { locale: conditions } : conditions;
    return this.store.run(
      {
        locale: resolveLocale(locale),
        region,
        enableI18n,
      },
      callback
    );
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

  getRegion(): string | undefined {
    const store = this.store.getStore();
    if (!store) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(REGION_MESSAGE);
        return undefined;
      }
      throw new Error(REGION_MESSAGE);
    }
    return store.region;
  }

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

  setLocale = (locale: string): void => {
    const store = this.store.getStore();
    if (store) store.locale = resolveLocale(locale);
  };

  setRegion = (region: string | undefined): void => {
    const store = this.store.getStore();
    if (store) store.region = region;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    const store = this.store.getStore();
    if (store) store.enableI18n = enableI18n;
  };
}

function resolveLocale(locale?: string): string {
  return getI18nConfig().resolveSupportedLocale(locale);
}
