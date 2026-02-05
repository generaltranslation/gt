import { StorageAdapter } from 'gt-i18n/internal';
import { AsyncLocalStorage } from 'node:async_hooks';

type Store = {
  locale: string;
};

export class AsyncStorageAdapter extends StorageAdapter {
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
    const currentStore = this.store.getStore();
    if (!currentStore) {
      return;
    }
    const newStore = { ...currentStore, [key]: value };
    this.store.enterWith(newStore);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  removeItem(key: keyof Store): void {
    // noop (locale is always set)
  }
}
