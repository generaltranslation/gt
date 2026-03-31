import {
  getI18nManager as getI18nManagerBase,
  I18nManager,
  setI18nManager as setI18nManagerBase,
  StorageAdapter,
} from 'gt-i18n/internal';
import { AsyncStorageAdapter } from './AsyncStorageAdapter';
import { Translation } from 'gt-i18n/src/i18n-manager/translations-manager/utils/types/translation-data';

/**
 * @description Get the singleton instance of I18nManager.
 * @returns The singleton instance of I18nManager
 *
 * Node only does string translation
 */
export function getI18nManager():
  | I18nManager<AsyncStorageAdapter, string>
  | I18nManager<StorageAdapter, string>
  | I18nManager<AsyncStorageAdapter, Translation>
  | I18nManager<StorageAdapter, Translation> {
  const i18nManager = getI18nManagerBase<AsyncStorageAdapter, string>();
  return i18nManager;
}

/**
 * Set the singleton instance of I18nManager
 * @param {I18nManager<AsyncStorageAdapter>} i18nManager - The I18nManager instance
 */
export function setI18nManager(
  i18nManager: I18nManager<AsyncStorageAdapter>
): void {
  setI18nManagerBase(i18nManager);
}
