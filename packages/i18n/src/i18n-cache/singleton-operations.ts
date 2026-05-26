import { libraryDefaultLocale } from 'generaltranslation/internal';
import { I18nManager } from './I18nCache';
import logger from '../logs/logger';
import { Translation } from './translations-manager/utils/types/translation-data';
import { createConditionStoreSingleton } from '../condition-store/createConditionStoreSingleton';
import { WritableConditionStoreInterface } from './types';

// Singleton instance of I18nManager
let i18nManager: I18nManager | undefined = undefined;

/**
 * Get the singleton instance of I18nManager
 * @returns The singleton instance of I18nManager
 * @template U - The type of the translation that will be cached
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function getI18nManager<U extends Translation = Translation>():
  | I18nManager<U>
  | I18nManager<Translation> {
  if (!i18nManager) {
    logger.warn(
      'getI18nManager(): I18nManager was not initialized. Falling back to the default locale until initializeGT() configures translations.'
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
 * Wrapper libraries will export a configure function that will call this function.
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function setI18nManager<TranslationValue extends Translation>(
  i18nManagerInstance: I18nManager<TranslationValue>
): void {
  i18nManager = i18nManagerInstance as unknown as I18nManager;
}
