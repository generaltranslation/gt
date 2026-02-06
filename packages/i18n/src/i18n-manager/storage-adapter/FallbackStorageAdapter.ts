import { StorageAdapter } from './StorageAdapter';
import { StorageAdapterType } from './types';

const FALLBACK_STORAGE_ADAPTER_TYPE: StorageAdapterType =
  'fallback-storage-adapter' as const;

/**
 * Fallback to storage adapter that is scoped to the entire process
 */
class FallbackStorageAdapter extends StorageAdapter {
  readonly type = FALLBACK_STORAGE_ADAPTER_TYPE;

  private storage: Record<string, string> = {};

  getItem(key: string): string | undefined {
    return this.storage[key];
  }

  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }

  removeItem(key: string): void {
    delete this.storage[key];
  }
}

export { FallbackStorageAdapter, FALLBACK_STORAGE_ADAPTER_TYPE };
