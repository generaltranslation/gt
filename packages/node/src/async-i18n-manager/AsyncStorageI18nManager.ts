import { I18nManager } from 'gt-i18n/internal';
import { AsyncStorageAdapter } from './AsyncStorageAdapter';
import { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import { determineLocale, isValidLocale } from 'generaltranslation';

/**
 * I18nManager implementation that uses AsyncStorage as the storage adapter.
 */
export class AsyncStorageI18nManager extends I18nManager<
  AsyncStorageAdapter,
  string
> {
  /**
   * Creates an instance of AsyncStorageI18nManager.
   * @param {I18nManagerConstructorParams<AsyncStorageAdapter>} config - The configuration for the AsyncStorageI18nManager
   */
  constructor(config: I18nManagerConstructorParams<AsyncStorageAdapter>) {
    super(config);
  }

  /**
   * Create the context for the given locale using the store adapter
   */
  run<T>(locale: string, fn: () => T): T {
    this.validateLocale(locale);
    return this.storeAdapter.run(
      {
        locale: determineLocale(
          locale,
          this.config.locales,
          this.config.customMapping
        )!,
      },
      fn
    );
  }

  // ----- PRIVATE METHODS ----- //

  /**
   * Validate locale
   */
  protected validateLocale(locale: string): void {
    if (
      !isValidLocale(locale, this.config.customMapping) ||
      !determineLocale(locale, this.config.locales, this.config.customMapping)
    ) {
      throw new Error(
        `I18nManager: validateLocale(): locale ${locale} is not valid`
      );
    }
  }
}
