import { getI18nCache } from '../../i18n-cache/singleton-operations';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import { GTTranslationOptions, TranslationMetadata } from '../types/options';
import { GTFunctionType } from '../types/functions';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import { createLookupOptions } from './helpers';
import type { StringFormat } from '@generaltranslation/format/types';
import { getWritableConditionStore } from '../../condition-store/singleton-operations';

export type Message = TranslationMetadata & {
  message: string;
};

/**
 * Returns the gt function that registers a string at build time and resolves its translation at runtime.
 * @returns A promise of the gt function
 *
 * @example
 * const gt = await getGT();
 * const greeting = gt('Hello, world!');
 */
export async function getGT(_messages?: Message[]): Promise<GTFunctionType> {
  const conditionStore = getWritableConditionStore();
  const locale = conditionStore.getLocale();
  const enableI18n = conditionStore.getEnableI18n();
  return getGTInternal({ locale, enableI18n }, _messages);
}

/**
 * Condition store agnostic getGT function
 */
export async function getGTInternal(
  {
    locale,
    enableI18n,
  }: {
    locale: string;
    enableI18n: boolean;
  },
  _messages?: Message[]
): Promise<GTFunctionType> {
  // Get the translation resolver
  const i18nCache = getI18nCache();
  const sourceLocale = getI18nConfig().getDefaultLocale();
  const devHotReloadEnabled = getI18nConfig().isDevHotReloadEnabled();
  const lookupTranslation = await i18nCache.getLookupTranslation(
    enableI18n ? locale : sourceLocale
  );

  // dev hot reload translate compiler injected lookups
  if (devHotReloadEnabled && lookupTranslation.prefetchEntries) {
    await lookupTranslation.prefetchEntries(
      _messages?.map(({ message, ...options }) => ({
        message,
        options: {
          $format: 'ICU',
          ...options,
        },
      })) ?? []
    );
  }

  /**
   * Registers a message at build time and resolves its translation at runtime.
   * @param {string} message - The message to translate
   * @param {GTTranslationOptions} options - The options for the translation
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
    options: GTTranslationOptions = {}
  ) => {
    const targetLocale = enableI18n
      ? (options.$locale ?? locale)
      : getI18nConfig().getDefaultLocale();
    const lookupOptions = createLookupOptions<StringFormat>(
      targetLocale,
      options,
      'ICU'
    );

    // Lookup translation
    const translation = lookupTranslation(message, lookupOptions);

    // Dev hot reload (fire and forget, will be available in a later lookup)
    if (devHotReloadEnabled && translation == null) {
      void i18nCache
        .lookupTranslationWithFallback(
          lookupOptions.$locale,
          message,
          lookupOptions
        )
        .catch(() => {});
    }

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
