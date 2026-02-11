import { StorageAdapter } from 'gt-i18n/internal';
import { AsyncLocalStorage } from 'node:async_hooks';

type Store = {
  locale: string;
};

const ASYNC_STORAGE_ADAPTER_TYPE = 'async-storage-adapter' as const;

/**
 * AsyncStorageAdapter implementation that uses AsyncLocalStorage as the storage adapter.
 */
class AsyncStorageAdapter extends StorageAdapter {
  readonly type = ASYNC_STORAGE_ADAPTER_TYPE;

  private store: AsyncLocalStorage<Store>;

  constructor(store?: AsyncLocalStorage<Store>) {
    super();
    this.store = store ?? new AsyncLocalStorage();
  }

  run<T>(store: Store, callback: () => T): T {
    return this.store.run(store, callback);
  }

  getItem(key: keyof Store): string | undefined {
    const store = this.store.getStore();
    if (!store) {
      return undefined;
    }
    return store[key];
  }

  setItem(key: keyof Store, value: string): void {
    const store = this.store.getStore();
    if (!store) {
      throw new Error(
        'setItem() called outside of an async context. Make sure you are inside a run() call.'
      );
    }
    store[key] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  removeItem(key: keyof Store): void {
    // noop (locale is always set)
  }
}

export { AsyncStorageAdapter, ASYNC_STORAGE_ADAPTER_TYPE };
