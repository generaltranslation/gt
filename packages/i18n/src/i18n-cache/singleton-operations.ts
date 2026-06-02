import { I18nCache } from './I18nCache';
import { Translation } from './translations-manager/utils/types/translation-data';

// Singleton instance of I18nCache
let i18nCache: I18nCache | undefined = undefined;

/**
 * Get the singleton instance of I18nCache
 * @returns The singleton instance of I18nCache
 * @template U - The type of the translation that will be cached
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function getI18nCache<U extends Translation = Translation>():
  | I18nCache<U>
  | I18nCache<Translation> {
  if (!i18nCache) {
    throw new Error(
      'getI18nCache(): I18nCache was not initialized. Call initializeGT() before accessing I18nCache.'
    );
  }
  return i18nCache;
}

/**
 * Configure the singleton instance of I18nCache
 * @param config - The configuration for the I18nCache
 *
 * Wrapper libraries will export a configure function that will call this function.
 *
 * Note: should not be consumed by gt-react, consumers should use a wrapper
 */
export function setI18nCache<TranslationValue extends Translation>(
  i18nCacheInstance: I18nCache<TranslationValue>
): void {
  i18nCache = i18nCacheInstance as unknown as I18nCache;
}
