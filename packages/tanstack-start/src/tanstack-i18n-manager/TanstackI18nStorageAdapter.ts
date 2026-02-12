import { StorageAdapter } from 'gt-i18n/internal';

const TANSTACK_I18N_STORAGE_ADAPTER_TYPE =
  'tanstack-i18n-storage-adapter' as const;

/**
 * StorageAdapter implementation for Tanstack Start.
 */
export class TanstackI18nStorageAdapter extends StorageAdapter {
  readonly type = TANSTACK_I18N_STORAGE_ADAPTER_TYPE;

  /**
   * This only supports 
   * @param key 
   * @returns 
   */
  getItem(key: string): string | undefined {
    return undefined;
  }

  setItem(key: string, value: string): void {
    // noop
  }

  removeItem(key: string): void {
    // noop
  }
}
