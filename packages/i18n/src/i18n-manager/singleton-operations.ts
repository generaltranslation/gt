import I18nManager from './I18nManager';

// Singleton instance of I18nManager
let i18nManager: I18nManager | undefined = undefined;

/**
 * Get the singleton instance of I18nManager
 * @returns The singleton instance of I18nManager
 */
export function getI18nManager(): I18nManager | undefined {
  if (!i18nManager) {
    console.warn(
      'Translation failed because I18nManager not initialized. Call configureI18nManager() first.'
    );
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
