import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { TanstackStorageAdapter } from './TanstackStorageAdapter';
import { GTProviderProps } from '../provider/types';

/**
 * I18nManager implementation for Tanstack Start.
 */
export class TanstackI18nManager extends I18nManager<TanstackStorageAdapter> {
  constructor(config: I18nManagerConstructorParams<TanstackStorageAdapter>) {
    super(config);
  }

  /**
   * Returns relevant configuration for the GTProvider
   */
  getProviderConfig(): GTProviderProps {
    return {
      defaultLocale: this.config.defaultLocale,
      locales: this.config.locales,
      customMapping: this.config.customMapping,
      enableI18n: this.config.enableI18n,
      loadTranslations: this.getTranslationLoader(),
    };
  }
}
