import { Cache } from './Cache';
import {
  getDictionaryEntry,
  getDictionaryObject,
  getDictionaryObjectValue,
  getDictionaryPath,
  getDictionaryValue,
  isDictionaryValue,
  replaceDictionary,
} from './utils/dictionary-helpers';
import type { LifecycleParam } from '../lifecycle-hooks/types';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryObject,
  DictionaryPath,
  DictionaryValue,
} from './utils/types/dictionary';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryLeaf,
  DictionaryObject,
  DictionaryOptions,
  DictionaryPath,
  DictionaryValue,
} from './utils/types/dictionary';

export type DictionaryRuntimeTranslate = (
  key: DictionaryKey
) => Promise<string>;

export type DictionaryRuntimeTranslateObj = (
  key: DictionaryKey
) => Promise<DictionaryObject>;

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
  private _runtimeTranslate: DictionaryRuntimeTranslate;
  private _runtimeTranslateObj: DictionaryRuntimeTranslateObj;

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Dictionary} params.init - The initial cache
   */
  constructor({
    init,
    lifecycle,
    runtimeTranslate,
    runtimeTranslateObj = async () => {
      throw new Error('DictionaryCache object fallback is not implemented');
    },
  }: {
    init: Dictionary;
    runtimeTranslate: DictionaryRuntimeTranslate;
    runtimeTranslateObj?: DictionaryRuntimeTranslateObj;
    lifecycle?: LifecycleParam<
      DictionaryKey,
      DictionaryPath,
      DictionaryValue,
      DictionaryEntry
    >;
  }) {
    super(init, lifecycle);
    this._runtimeTranslate = runtimeTranslate;
    this._runtimeTranslateObj = runtimeTranslateObj;
  }

  /**
   * Get the dictionary value for a given key
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public get(key: DictionaryKey): DictionaryEntry | undefined {
    const value = this.getCache(key);
    const entry = getDictionaryEntry(value);
    if (entry === undefined) {
      return undefined;
    }

    if (this.onHit) {
      this.onHit({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value as DictionaryValue,
        outputValue: entry,
      });
    }
    return entry;
  }

  public set(key: DictionaryKey, value: DictionaryEntry): void {
    const dictionaryValue = getDictionaryValue(value);
    this.setCache(this.genKey(key), dictionaryValue);
  }

  public getObj(key: DictionaryKey): DictionaryObject | undefined {
    return getDictionaryObject(this.getCache(key));
  }

  public setObj(key: DictionaryKey, value: DictionaryObject): void {
    this.setCache(this.genKey(key), getDictionaryObjectValue(value));
  }

  public async missObj(key: DictionaryKey): Promise<DictionaryObject> {
    const value = await this._runtimeTranslateObj(key);
    this.setObj(key, value);
    return value;
  }

  /**
   * Miss the cache
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public async miss(key: DictionaryKey): Promise<DictionaryEntry> {
    const value = await this.missCache(key);
    const entry = getDictionaryEntry(value);
    if (entry === undefined) {
      // Never will happen
      throw new Error(
        'DictionaryCache missCache did not return a DictionaryEntry'
      );
    }
    if (this.onMiss) {
      this.onMiss({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value,
        outputValue: entry,
      });
    }
    return entry;
  }

  /**
   * Set the value for a key
   */
  protected setCache(cacheKey: DictionaryPath, value: DictionaryValue): void {
    const cache = this.getInternalCache() as Dictionary;
    const dictionaryPath = getDictionaryPath(cacheKey);

    if (dictionaryPath.length === 0) {
      if (isDictionaryValue(value)) {
        replaceDictionary(cache, value);
      }
      return;
    }

    let current = cache;
    for (const key of dictionaryPath.slice(0, -1)) {
      const next = current[key];
      if (!isDictionaryValue(next)) {
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
      if (!isDictionaryValue(current)) {
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
   *
   * @throws {Error} - If the fallback is not implemented
   */
  protected fallback(key: DictionaryKey): Promise<DictionaryValue> {
    return this._runtimeTranslate(key);
  }
}
