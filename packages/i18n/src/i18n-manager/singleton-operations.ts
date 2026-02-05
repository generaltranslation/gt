import { libraryDefaultLocale } from 'generaltranslation/internal';
import I18nManager from './I18nManager';
import logger from '../logs/logger';

// Singleton instance of I18nManager
let i18nManager: I18nManager | undefined = undefined;

/**
 * Get the singleton instance of I18nManager
 * @returns The singleton instance of I18nManager
 *
 * @internal
 */
export function getI18nManager(): I18nManager {
  if (!i18nManager) {
    logger.warn(
      'Translation failed because I18nManager not initialized. Falling back to library default locale: ' +
        libraryDefaultLocale
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
 *
 * @internal
 */
export function setI18nManager(i18nManagerInstance: I18nManager): void {
  i18nManager = i18nManagerInstance;
}
