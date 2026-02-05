import { GTConfig, TranslationsLoader } from 'gt-i18n/types';

/**
 * Parameters for the configuring GT setup
 * @param {string} config.defaultLocale - The default locale to use
 * @param {string[]} config.locales - The locales to support
 * @param {object} config.customTranslationLoader - The custom translation loader to use
 * @param {function} config.customTranslationLoader.load - The function to load the translations
 */
export type ConfigGTParams = GTConfig & {
  customTranslationLoader?: TranslationsLoader;
};
