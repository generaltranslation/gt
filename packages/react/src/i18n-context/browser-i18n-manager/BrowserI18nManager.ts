import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { BrowserStorageAdapter } from './BrowserStorageAdapter';
import type { HtmlTagOptions } from './utils/types';
import { determineLocale as gtDetermineLocale } from 'generaltranslation';
import { createInvalidLocaleWarning } from '../../shared/messages';
import { Translation } from 'gt-i18n/types';
import { DEFAULT_HTML_TAG_OPTIONS } from './utils/constants';

/**
 * The configuration for the BrowserI18nManager
 */
type BrowserI18nManagerConstructorParams =
  I18nManagerConstructorParams<BrowserStorageAdapter> & {
    htmlTagOptions?: HtmlTagOptions;
  };

/**
 * I18nManager implementation for Browser.
 */
export class BrowserI18nManager extends I18nManager<
  BrowserStorageAdapter,
  Translation
> {
  /** Customize browser-related behavior */
  private htmlTagOptions?: HtmlTagOptions;

  constructor(config: BrowserI18nManagerConstructorParams) {
    super(config);
    this.storeAdapter.setConfig({
      defaultLocale: this.getDefaultLocale(),
      locales: this.getLocales(),
      customMapping: config.customMapping,
    });

    this.htmlTagOptions = {
      ...DEFAULT_HTML_TAG_OPTIONS,
      ...config.htmlTagOptions,
    };
  }

  /**
   * Returns the current locale
   * @returns {string} The current locale
   */
  getLocale(): string {
    return this.storeAdapter.getItem('locale') || this.config.defaultLocale;
  }

  /**
   * Set the locale
   * @param {string} locale - The locale to set
   * @returns {void}
   *
   * @note This function causes a page reload
   */
  setLocale(locale: string): void {
    if (!gtDetermineLocale(locale, this.getLocales())) {
      console.warn(createInvalidLocaleWarning(locale));
      return;
    }
    this.storeAdapter.setItem('locale', locale);
    window.location.reload();
  }

  /**
   * Update the html tag (lang, dir)
   */
  updateHtmlTag(
    htmlTagOptions?: { lang?: string; dir?: 'ltr' | 'rtl' } & HtmlTagOptions
  ): void {
    // Get parameters
    const locale = htmlTagOptions?.lang || this.getLocale();
    const gtInstance = this.getGTClass();
    const canonicalLocale = gtInstance.resolveCanonicalLocale(locale);
    const localeDirection =
      htmlTagOptions?.dir || gtInstance.getLocaleDirection(locale);

    // Validate parameters
    if (!gtInstance.isValidLocale(canonicalLocale)) {
      console.warn(createInvalidLocaleWarning(locale));
      return;
    }

    // Merge options
    const mergedHtmlTagOptions = {
      ...this.htmlTagOptions,
      ...htmlTagOptions,
    };

    // Update html tag
    if (mergedHtmlTagOptions.updateHtmlLangTag) {
      document.documentElement.lang = canonicalLocale;
    }
    if (mergedHtmlTagOptions.updateHtmlDirTag) {
      document.documentElement.dir = localeDirection;
    }
  }
}
