import type { GTConfig, TranslationsLoader } from 'gt-i18n/internal/types';
import { GetLocale, HtmlTagOptions } from '../browser-i18n-manager/utils/types';

/**
 * Parameters for the initializing GT
 * @param {string} params.defaultLocale - The default locale to use
 * @param {string[]} params.locales - The locales to support
 * @param {TranslationsLoader} params.loadTranslations - The custom translation loader to use
 * @param {GetLocale} [params.getLocale] - The function to get the locale
 * @param {HtmlTagOptions} [params.htmlTagOptions.updateHtmlLangTag] - (true) Whether to update the html lang tag on locale change
 * @param {HtmlTagOptions} [params.htmlTagOptions.updateHtmlDirTag] - (true) Whether to update the html dir tag on locale change
 */
export type InitializeGTParams = GTConfig & {
  loadTranslations?: TranslationsLoader;
  getLocale?: GetLocale;
  htmlTagOptions?: HtmlTagOptions;
};

// Other Reexports
export type { GTConfig, TranslationsLoader } from 'gt-i18n/internal/types';
export type { GetLocale } from '../browser-i18n-manager/utils/types';
