import { AsyncLocalStorage } from 'node:async_hooks';
import { createLocaleResolver } from 'gt-i18n/internal';
import type {
  LocaleCandidates,
  ConditionStoreConfig,
  ScopedConditionStore,
} from 'gt-i18n/internal/types';

type Store = {
  locale: string;
};

type AsyncConditionStoreConstructorParams = ConditionStoreConfig & {
  store?: AsyncLocalStorage<Store>;
};

/**
 * Condition store implementation that uses AsyncLocalStorage.
 */
export class AsyncConditionStore implements ScopedConditionStore {
  private store: AsyncLocalStorage<Store>;
  private resolveLocale: (candidates?: LocaleCandidates) => string;

  constructor({
    defaultLocale,
    locales,
    customMapping,
    store,
  }: AsyncConditionStoreConstructorParams = {}) {
    this.store = store ?? new AsyncLocalStorage();
    this.resolveLocale = createLocaleResolver({
      defaultLocale,
      locales,
      customMapping,
    });
  }

  run<T>(locale: string, callback: () => T): T {
    return this.store.run({ locale: this.resolveLocale(locale) }, callback);
  }

  getLocale(): string {
    const store = this.store.getStore();
    // Outside an AsyncLocalStorage scope, resolveLocale(undefined) falls back to the default locale.
    return this.resolveLocale(store?.locale);
  }
}
