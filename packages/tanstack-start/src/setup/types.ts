import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';

/**
 * Parameters for the initializing GT
 * @param {string} params.defaultLocale - The default locale to use
 * @param {string[]} params.locales - The locales to support
 * @param {object} params.loadTranslations - The custom translation loader to use
 */
export type InitializeGTParams = I18nManagerConstructorParams;

// Other Reexports
export type {
  DictionaryConfig,
  GTConfig,
  I18nManagerConstructorParams,
  TranslationsLoader,
} from 'gt-i18n/internal/types';
