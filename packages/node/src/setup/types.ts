import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';

/**
 * Parameters for the initializing GT
 * @param {string} params.defaultLocale - The default locale to use
 * @param {string[]} params.locales - The locales to support
 * @param {object} params.loadTranslations - The custom translation loader to use
 */
export type InitializeGTParams = I18nConfigParams & I18nCacheConstructorParams;

// Other Reexports
export type { GTConfig } from 'generaltranslation/types';
export type { TranslationsLoader } from 'gt-i18n/internal/types';
