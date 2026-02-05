import { GTConfig, TranslationsLoader } from 'gt-i18n/types';

/**
 * Parameters for the initializing GT
 * @param {string} config.defaultLocale - The default locale to use
 * @param {string[]} config.locales - The locales to support
 * @param {object} config.customTranslationLoader - The custom translation loader to use
 * @param {function} config.customTranslationLoader.load - The function to load the translations
 */
export type InitializeGTParams = GTConfig & {
  loadTranslations?: TranslationsLoader;
};
