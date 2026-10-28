import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
} from 'gt-i18n/internal';

/**
 * Parameters for the initializing GT
 * @param {string} params.defaultLocale - The default locale to use
 * @param {string[]} params.locales - The locales to support
 * @param {object} params.loadTranslations - The custom translation loader to use
 */
export type InitializeGTParams = I18nConfigParams & I18nCacheConstructorParams;
