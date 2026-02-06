import {
  getI18nManager as getI18nManagerBase,
  I18nManager,
  setI18nManager as setI18nManagerBase,
  StorageAdapter,
} from 'gt-i18n/internal';
import { AsyncStorageAdapter } from './AsyncStorageAdapter';

/**
 * @description Get the singleton instance of I18nManager.
 * @returns The singleton instance of I18nManager
 *
 */
export function getI18nManager():
  | I18nManager<AsyncStorageAdapter>
  | I18nManager<StorageAdapter> {
  const i18nManager = getI18nManagerBase();
  return i18nManager;
}

export function setI18nManager(i18nManager: I18nManager): void {
  setI18nManagerBase(i18nManager);
}
