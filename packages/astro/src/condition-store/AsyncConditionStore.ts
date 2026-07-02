import { AsyncLocalStorage } from 'node:async_hooks';
import type { ScopedConditionStoreInterface } from 'gt-i18n/internal/types';
import { getI18nConfig } from 'gt-i18n/internal';

type Store = {
  locale: string;
  region?: string;
  enableI18n?: boolean;
};

const OUTSIDE_SCOPE_MESSAGE =
  'gt-astro: getLocale() called outside of a request scope. ' +
  'Translation functions must run during a request handled by the gt-astro middleware ' +
  '(or inside a withGT() scope).';

const REGION_MESSAGE =
  'gt-astro: getRegion() called outside of a request scope.';

const ENABLE_I18N_MESSAGE =
  'gt-astro: getEnableI18n() called outside of a request scope.';

type AsyncConditionStoreConstructorParams = {
  store?: AsyncLocalStorage<Store>;
};

/**
 * Condition store implementation that uses AsyncLocalStorage so each request
 * rendered by Astro resolves its own locale.
 */
export class AsyncConditionStore implements ScopedConditionStoreInterface {
  private store: AsyncLocalStorage<Store>;

  constructor({ store }: AsyncConditionStoreConstructorParams = {}) {
    this.store = store ?? new AsyncLocalStorage();
  }

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

  setLocale = (_locale: string): void => {};

  setRegion = (_region: string | undefined): void => {};

  setEnableI18n = (_enableI18n: boolean): void => {};
}

function resolveLocale(locale?: string): string {
  return getI18nConfig().resolveSupportedLocale(locale);
}
