import { StorageAdapter } from 'gt-i18n/internal';
import { AsyncLocalStorage } from 'node:async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

export class AsyncStorageAdapter extends StorageAdapter {
  getItem(key: string): string | undefined {
    return asyncLocalStorage.getStore()?.get(key);
  }

  setItem(key: string, value: string): void {
    asyncLocalStorage.getStore()?.set(key, value);
  }

  removeItem(key: string): void {
    asyncLocalStorage.getStore()?.delete(key);
  }
}
