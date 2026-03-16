import type { GTConfig, TranslationsLoader } from 'gt-i18n/internal/types';
import { GetLocale } from '../browser-i18n-manager/utils/types';

/**
 * Parameters for the initializing GT
 * @param {string} params.defaultLocale - The default locale to use
 * @param {string[]} params.locales - The locales to support
 * @param {GetLocale} params.getLocale - The function to get the locale
 * @param {TranslationsLoader} params.loadTranslations - The custom translation loader to use
 */
export type InitializeGTParams = GTConfig & {
  loadTranslations?: TranslationsLoader;
  getLocale?: GetLocale;
};

// Other Reexports
export type { GTConfig, TranslationsLoader } from 'gt-i18n/internal/types';
export type { GetLocale } from '../browser-i18n-manager/utils/types';
