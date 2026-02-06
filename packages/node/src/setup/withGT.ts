import { getI18nManager } from '../i18n-manager/singleton-operations';
import {
  AsyncStorageAdapter,
  ASYNC_STORAGE_ADAPTER_TYPE,
} from '../i18n-manager/AsyncStorageAdapter';
import { I18nManager, StorageAdapter } from 'gt-i18n/internal';
import { AsyncStorageI18nManager } from '../i18n-manager/AsyncStorageI18nManager';

/**
 * This function wraps entry points to provide GT context
 */
export function withGT<T>(locale: string, fn: () => T): T {
  const i18nManager = getI18nManager();
  if (!isAsyncStorageI18nManager(i18nManager)) {
    throw new Error(
      'I18nManager not initialized. Invoke configGT() to initialize.'
    );
  }

  return i18nManager.run<T>(locale, fn);
}

// ========== Helper functions ========== //

/**
 * Check if the I18nManager is an AsyncStorageI18nManager
 * @param i18nManager - The I18nManager instance
 * @returns True if the I18nManager is an AsyncStorageI18nManager, false otherwise
 */
function isAsyncStorageI18nManager(
  i18nManager: I18nManager<AsyncStorageAdapter> | I18nManager<StorageAdapter>
): i18nManager is AsyncStorageI18nManager {
  return (
    i18nManager.getAdapterType() === ASYNC_STORAGE_ADAPTER_TYPE &&
    'run' in i18nManager &&
    typeof i18nManager.run === 'function'
  );
}
