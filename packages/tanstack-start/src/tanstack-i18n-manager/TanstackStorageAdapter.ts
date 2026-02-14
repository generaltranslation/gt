import { StorageAdapter } from 'gt-i18n/internal';
import { determineLocale } from '../functions/determineLocale';

const TANSTACK_I18N_STORAGE_ADAPTER_TYPE =
  'tanstack-i18n-storage-adapter' as const;

/**
 * StorageAdapter implementation for Tanstack Start.
 */
export class TanstackStorageAdapter extends StorageAdapter {
  readonly type = TANSTACK_I18N_STORAGE_ADAPTER_TYPE;

  /**
   * This only supports
   * @param key
   * @returns
   */
  getItem(key: string): string | undefined {
    if (key === 'locale') {
      return determineLocale();
    }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  setItem(key: string, value: string): void {
    // noop
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  removeItem(key: string): void {
    // noop
  }
}
