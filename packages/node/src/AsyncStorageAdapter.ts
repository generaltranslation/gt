import { StorageAdapter } from 'gt-i18n/internal';
import { AsyncLocalStorage } from 'node:async_hooks';

export class AsyncStorageAdapter extends StorageAdapter {
  getItem(key: string): string | undefined {}

  setItem(key: string, value: string): void {}

  removeItem(key: string): void {}
}
