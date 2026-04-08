import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { BrowserStorageAdapter } from './BrowserStorageAdapter';
import { determineLocale as gtDetermineLocale } from 'generaltranslation';
import { createInvalidLocaleWarning } from '../../shared/messages';
import { Translation } from 'gt-i18n/types';

/**
 * I18nManager implementation for Browser.
 */
export class BrowserI18nManager extends I18nManager<
  BrowserStorageAdapter,
  Translation
> {
  constructor(config: I18nManagerConstructorParams<BrowserStorageAdapter>) {
    super(config);
    this.storeAdapter.setConfig({
      defaultLocale: this.getDefaultLocale(),
      locales: this.getLocales(),
      customMapping: config.customMapping,
    });
  }

  /**
   * Load translations for a given locale
   * @param {string} locale - The locale to load translations for
   * @returns {Promise<void>} A promise that resolves when the translations are loaded
   */
  async loadTranslations(locale: string = this.getLocale()): Promise<void> {
    await this.getTranslations(locale);
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
}
