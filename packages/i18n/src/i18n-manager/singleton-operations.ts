import { libraryDefaultLocale } from 'generaltranslation/internal';
import { I18nManager } from './I18nManager';
import logger from '../logs/logger';
import { StorageAdapter } from './storage-adapter/StorageAdapter';
import { Translation } from './translations-manager/utils/types/translation-data';

// Singleton instance of I18nManager
let i18nManager: I18nManager | undefined = undefined;

/**
 * Get the singleton instance of I18nManager
 * @returns The singleton instance of I18nManager
 * @template T - The type of the storage adapter
 * @template U - The type of the translation that will be cached
 */
export function getI18nManager<
  T extends StorageAdapter = StorageAdapter,
  U extends Translation = Translation,
>():
  | I18nManager<T, U>
  | I18nManager<T, Translation>
  | I18nManager<StorageAdapter, U>
  | I18nManager<StorageAdapter, Translation> {
  if (!i18nManager) {
    logger.warn(
      'getI18nManager(): Translation failed because I18nManager not initialized.'
    );
    i18nManager = new I18nManager({
      defaultLocale: libraryDefaultLocale,
      locales: [libraryDefaultLocale],
    });
  }
  return i18nManager;
}

/**
 * Configure the singleton instance of I18nManager
 * @param config - The configuration for the I18nManager
 *
 * Wraper libraries will export a configure function that will call this function.
 */
export function setI18nManager(i18nManagerInstance: I18nManager): void {
  i18nManager = i18nManagerInstance;
}
