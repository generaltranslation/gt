import { libraryDefaultLocale } from 'generaltranslation/internal';
import { I18nManager } from './I18nManager';
import logger from '../logs/logger';
import { Translation } from './translations-manager/utils/types/translation-data';
import type { ConditionStore } from './types';

// Singleton instance of I18nManager
let i18nManager: I18nManager | undefined = undefined;
let fallbackDefaultLocale: string = libraryDefaultLocale;
// Used before wrapper runtimes install a condition store; tracks the active manager default.
const fallbackConditionStore: ConditionStore = {
  getLocale: () => fallbackDefaultLocale,
};
let conditionStore: ConditionStore = fallbackConditionStore;

/**
 * Get the singleton instance of I18nManager
 * @returns The singleton instance of I18nManager
 * @template U - The type of the translation that will be cached
 */
export function getI18nManager<U extends Translation = Translation>():
  | I18nManager<U>
  | I18nManager<Translation> {
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
 * Resolve the current locale from the configured runtime condition source.
 */
export function getCurrentLocale(): string {
  return conditionStore.getLocale();
}

/**
 * Configure the runtime condition source.
 */
export function setConditionStore(nextConditionStore: ConditionStore): void {
  conditionStore = nextConditionStore;
}

/**
 * Configure the singleton instance of I18nManager
 * @param config - The configuration for the I18nManager
 *
 * Wrapper libraries will export a configure function that will call this function.
 */
export function setI18nManager<TranslationValue extends Translation>(
  i18nManagerInstance: I18nManager<TranslationValue>
): void {
  i18nManager = i18nManagerInstance as unknown as I18nManager;
  fallbackDefaultLocale = i18nManagerInstance.getDefaultLocale();
}
