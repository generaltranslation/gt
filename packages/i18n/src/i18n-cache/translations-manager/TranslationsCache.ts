import { LookupOptions } from '../../translation-functions/types/options';
import { Translation } from './utils/types/translation-data';
import { hashMessage } from '../../utils/hashMessage';
import type { ResolveMissingTranslation } from './MissingTranslationResolver';

export type { TranslationBatchConfig } from './MissingTranslationResolver';

/**
 * InputKey type for lookups
 * @typedef {Object} TranslationKey
 * @property {TranslationValue} message - The message from the source
 * @property {LookupOptions} options - The options for the translation
 */
export type TranslationKey<TranslationValue extends Translation> = {
  message: TranslationValue;
  options: LookupOptions;
};

/**
 * Just a way to be more explicit about what "hash" is
 */
export type Hash = string;

/**
 * Just being explicit about the purpose of this type
 */
export type Locale = string;

/**
 * Called when a translation is resolved through a runtime cache miss.
 * Locale is handled by the I18nCache that owns this cache, so it is not
 * passed here.
 */
export type TranslationsCacheMissCallback<
  TranslationValue extends Translation,
> = (hash: Hash, translation: TranslationValue) => void;

/**
 * A cache for a single locale's translations
 *
 * Principles:
 * - This class is language agnostic, and should never store the locale code as a parameter.
 *   Locale logic is handled by the owning I18nCache. Use a callback function that has the
 *   locale parameter embedded if you wish to use the locale code.
 */
export class TranslationsCache<TranslationValue extends Translation> {
  private cache: Record<Hash, TranslationValue>;
  private resolveMissingTranslation?: ResolveMissingTranslation<TranslationValue>;
  private onMiss?: TranslationsCacheMissCallback<TranslationValue>;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Record<Hash, TranslationValue>} params.init - The initial cache
   * @param {Function} params.fallback - Get the fallback value for a cache miss
   */
  constructor({
    init,
    resolveMissingTranslation,
    onMiss,
  }: {
    init: Record<Hash, TranslationValue>;
    resolveMissingTranslation?: ResolveMissingTranslation<TranslationValue>;
    onMiss?: TranslationsCacheMissCallback<TranslationValue>;
  }) {
    this.cache = structuredClone(init);
    this.resolveMissingTranslation = resolveMissingTranslation;
    this.onMiss = onMiss;
  }

  /**
   * Get the translation value for a given key
   * @param key - The translation key
   * @returns The translation value
   */
  public get<T extends TranslationValue>(
    key: TranslationKey<T>
  ): T | undefined {
    const cacheKey = this.getCacheKey(key);
    return this.cache[cacheKey] as T | undefined;
  }

  /**
   * Miss the cache
   * @param key - The translation key
   * @returns The translation value
   */
  public async miss<T extends TranslationValue>(
    key: TranslationKey<T>
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key);
    const value = await this.resolveMissingTranslation?.({
      hash: cacheKey,
      source: key.message,
      options: key.options,
    });
    if (value != null) {
      this.cache[cacheKey] = value;
      this.onMiss?.(cacheKey, value);
      return value as T;
    }
    return key.message;
  }

  public getInternalCache(): Record<Hash, TranslationValue> {
    return structuredClone(this.cache);
  }

  private getCacheKey(key: TranslationKey<TranslationValue>): Hash {
    return hashMessage(key.message, key.options);
  }

  public update(translations: Record<Hash, TranslationValue>): void {
    this.cache = { ...this.cache, ...translations };
  }
}
