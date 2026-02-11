import { I18nManager } from 'gt-i18n/internal';
import { AsyncStorageAdapter } from './AsyncStorageAdapter';
import { I18nManagerConstructorParams } from 'gt-i18n/internal-types';

/**
 * I18nManager implementation that uses AsyncStorage as the storage adapter.
 */
export class AsyncStorageI18nManager extends I18nManager<AsyncStorageAdapter> {
  /**
   * Creates an instance of AsyncStorageI18nManager.
   * @param {I18nManagerConstructorParams<AsyncStorageAdapter>} config - The configuration for the AsyncStorageI18nManager
   */
  constructor(config: I18nManagerConstructorParams<AsyncStorageAdapter>) {
    super(config);
  }

  /**
   * Create the context for the given locale using the store adapter
   */
  run<T>(locale: string, fn: () => T): T {
    return this.storeAdapter.run({ locale }, fn);
  }
}
