import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { InlineTranslationOptions } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { createLookupOptions } from './helpers';
import type { StringFormat } from '@generaltranslation/format/types';
import { getLocale } from '../../helpers/locale';
import { getEnableI18n } from '../../helpers/conditions';

/**
 * Request conditions consumed by the internal translation functions.
 * Runtimes that resolve conditions asynchronously (e.g. gt-next) collect
 * these in request scope and pass them in as parameters.
 */
export type I18nRequestConditions = {
  locale: string;
  enableI18n?: boolean;
};

/**
 * Returns the gt function that registers a string at build time and resolves its translation at runtime.
 * @returns A promise of the gt function
 * @important Must be used inside of a request context
 *
 * @example
 * const gt = await getGT();
 * const greeting = gt('Hello, world!');
 */
export async function getGT(): Promise<GTFunctionType> {
  return getGTInternal({
    locale: getLocale(),
    enableI18n: getEnableI18n(),
  });
}

/**
 * Condition-store-free version of {@link getGT}: request conditions are
 * passed as parameters instead of being read from the condition store.
 * @param {I18nRequestConditions} conditions - The request conditions
 * @returns A promise of the gt function
 */
export async function getGTInternal({
  locale,
  enableI18n = true,
}: I18nRequestConditions): Promise<GTFunctionType> {
  // Get the translation resolver
  const i18nCache = getI18nCache();
  if (enableI18n) {
    await i18nCache.loadTranslations(locale);
  }
  const sourceLocale = getI18nConfig().getDefaultLocale();

  /**
   * Registers a message at build time and resolves its translation at runtime.
   * @param {string} message - The message to translate
   * @param {InlineTranslationOptions} options - The options for the translation
   * @returns The translated message
   *
   * @example
   * // Simple translation without interpolation
   * const gt = await getGT();
   * const greeting = gt('Hello, world!');
   *
   * @example
   * // Translation with interpolation
   * const gt = await getGT();
   * const welcome = gt('Hello, {name}!', { name: 'Alice' });
   */
  const gt: GTFunctionType = (
    message: string,
    options: InlineTranslationOptions = {}
  ) => {
    const targetLocale = options.$locale ?? locale;
    const lookupOptions = createLookupOptions<StringFormat>(
      targetLocale,
      options,
      'ICU'
    );

    // Lookup translation
    const translation = enableI18n
      ? i18nCache.lookupTranslation(
          lookupOptions.$locale,
          message,
          lookupOptions
        )
      : undefined;

    // Format result
    return interpolateMessage({
      source: message,
      target: translation,
      options: lookupOptions,
      sourceLocale,
    });
  };

  return gt;
}
