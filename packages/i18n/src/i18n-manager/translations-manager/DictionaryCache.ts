import { Cache } from './Cache';
import type { LifecycleParam } from '../lifecycle-hooks/types';

/**
 * A dictionary is a nested object with strings as leaf values
 */
export type Dictionary = {
  [key: string]: DictionaryValue;
};

/**
 * Value stored in a dictionary
 */
export type DictionaryValue = string | Dictionary;

/**
 * Value returned from a dictionary lookup
 */
export type DictionaryEntry = string;

/**
 * Just a way to be more explicit about what "dictionary path" is
 */
export type DictionaryPath = string;

/**
 * InputKey type for lookups
 */
export type DictionaryKey = DictionaryPath;

/**
 * A cache for a single locale's dictionary
 *
 * Principles:
 * - This class is language agnostic, and should never store the locale code as a parameter.
 *   Locale logic is handled at the LocalesDictionaryCache level. Use a callback function
 *   that has the locale parameter embedded if you wish to use the locale code.
 */
export class DictionaryCache extends Cache<
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
  DictionaryEntry
> {
  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Dictionary} params.init - The initial cache
   */
  constructor({
    init,
    lifecycle,
  }: {
    init: Dictionary;
    lifecycle?: LifecycleParam<
      DictionaryKey,
      DictionaryPath,
      DictionaryValue,
      DictionaryEntry
    >;
  }) {
    super(init, lifecycle);
  }

  /**
   * Get the dictionary value for a given key
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public get(key: DictionaryKey): DictionaryEntry | undefined {
    const value = this.getCache(key);
    if (typeof value !== 'string') {
      return undefined;
    }

    if (this.onHit) {
      this.onHit({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value,
        outputValue: value,
      });
    }
    return value;
  }

  /**
   * Miss the cache
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public async miss(key: DictionaryKey): Promise<DictionaryEntry | undefined> {
    const value = await this.missCache(key);
    if (typeof value === 'string' && this.onMiss) {
      this.onMiss({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value,
        outputValue: value,
      });
    }
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Set the value for a key
   */
  protected setCache(cacheKey: DictionaryPath, value: DictionaryValue): void {
    const cache = this.getInternalCache() as Dictionary;
    const dictionaryPath = getDictionaryPath(cacheKey);

    if (dictionaryPath.length === 0) {
      if (typeof value !== 'string') {
        replaceDictionary(cache, value);
      }
      return;
    }

    let current = cache;
    for (const key of dictionaryPath.slice(0, -1)) {
      const next = current[key];
      if (typeof next !== 'object' || next == null) {
        current[key] = {};
      }
      current = current[key] as Dictionary;
    }

    current[dictionaryPath[dictionaryPath.length - 1]] = value;
  }

  /**
   * Look up the key
   */
  protected getCache(key: DictionaryKey): DictionaryValue | undefined {
    const dictionaryPath = getDictionaryPath(this.genKey(key));
    let current: DictionaryValue = this.getInternalCache() as Dictionary;

    if (dictionaryPath.length === 0) {
      return current;
    }

    for (const pathSegment of dictionaryPath) {
      if (typeof current !== 'object' || current == null) {
        return undefined;
      }
      current = current[pathSegment];
    }

    return current;
  }

  /**
   * Generate a key for the cache
   * @param key - The dictionary key
   * @returns The key
   */
  protected genKey(key: DictionaryKey): DictionaryPath {
    return key;
  }

  /**
   * Get the fallback value for a cache miss
   * @param key - The dictionary key
   * @returns The fallback value
   */
  protected fallback(): Promise<DictionaryValue> {
    return Promise.resolve('');
  }
}

/**
 * Convert a dictionary path string to path segments
 */
function getDictionaryPath(id: DictionaryPath): string[] {
  if (!id) {
    return [];
  }
  return id.split('.');
}

/**
 * Replace a dictionary object while preserving its reference
 */
function replaceDictionary(target: Dictionary, source: Dictionary): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}
