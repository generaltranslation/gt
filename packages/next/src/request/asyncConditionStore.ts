import { AsyncLocalStorage } from 'node:async_hooks';
import { setReadonlyConditionStore } from 'gt-react/context';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { getEnableI18n } from './getEnableI18n';
import { getLocale } from './getLocale';

export type RequestConditions = {
  locale: string;
  enableI18n: boolean;
};

class NextAsyncConditionStore implements ReadonlyConditionStoreInterface {
  private readonly store = new AsyncLocalStorage<RequestConditions>();

  async run<T>(
    callback: (conditions: RequestConditions) => T | Promise<T>
  ): Promise<T> {
    const conditions = await getRequestConditionValues();
    return this.store.run(conditions, () => callback(conditions));
  }

  getLocale = (): string => {
    return this.getStore().locale;
  };

  getEnableI18n = (): boolean => {
    return this.getStore().enableI18n;
  };

  setLocale = (_locale: string): void => {};

  setEnableI18n = (_enabled: boolean): void => {};

  private getStore(): RequestConditions {
    const store = this.store.getStore();
    if (!store) {
      throw new Error(
        'NextAsyncConditionStore: request conditions are unavailable outside a gt-next request scope.'
      );
    }
    return store;
  }
}

const nextAsyncConditionStore = new NextAsyncConditionStore();
let isNextConditionStoreRegistered = false;

export async function getRequestConditionValues(): Promise<RequestConditions> {
  const [locale, enableI18n] = await Promise.all([
    getLocale(),
    getEnableI18n(),
  ]);
  return { locale, enableI18n };
}

export async function withRequestConditions<T>(
  callback: (conditions: RequestConditions) => T | Promise<T>
): Promise<T> {
  if (!isNextConditionStoreRegistered) {
    setReadonlyConditionStore(nextAsyncConditionStore);
    isNextConditionStoreRegistered = true;
  }
  return nextAsyncConditionStore.run(callback);
}
