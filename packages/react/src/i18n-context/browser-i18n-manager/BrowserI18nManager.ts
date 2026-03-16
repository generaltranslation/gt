import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { BrowserStorageAdapter } from './BrowserStorageAdapter';

/**
 * I18nManager implementation for Browser.
 */
export class BrowserI18nManager extends I18nManager<BrowserStorageAdapter> {
  constructor(config: I18nManagerConstructorParams<BrowserStorageAdapter>) {
    super(config);
  }

  /**
   * Load translations for a given locale
   * @param {string} locale - The locale to load translations for
   * @returns {Promise<void>} A promise that resolves when the translations are loaded
   */
  async loadTranslations(locale: string = this.getLocale()): Promise<void> {
    await this.getTranslations(locale);
  }
}
