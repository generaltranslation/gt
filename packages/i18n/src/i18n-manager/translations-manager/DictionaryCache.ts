import { Cache } from './Cache';
import {
  getDictionaryEntry,
  getDictionaryPath,
  getDictionaryValue,
  isDictionaryValue,
  replaceDictionary,
} from './utils/dictionary-helpers';
import type {
  LifecycleCallback,
  LifecycleParam,
} from '../lifecycle-hooks/types';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
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
  key: DictionaryKey,
  sourceEntry: DictionaryEntry
) => Promise<string>;

export type DictionaryObjectLifecycleParam = {
  onHitObj?: LifecycleCallback<
    DictionaryKey,
    DictionaryPath,
    DictionaryValue,
    DictionaryValue
  >;
  onMissObj?: LifecycleCallback<
    DictionaryKey,
    DictionaryPath,
    DictionaryValue,
    DictionaryValue
  >;
};

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
  DictionaryEntry,
  [DictionaryKey, DictionaryEntry]
> {
  private _runtimeTranslate: DictionaryRuntimeTranslate;
  private onHitObj?: DictionaryObjectLifecycleParam['onHitObj'];
  // TODO: Wire this when object miss handling is introduced.
  private onMissObj?: DictionaryObjectLifecycleParam['onMissObj'];

  /**
   * Constructor
   * @param {Object} params - The parameters for the cache
   * @param {Dictionary} params.init - The initial cache
   */
  constructor({
    init,
    lifecycle,
    runtimeTranslate,
  }: {
    init: Dictionary;
    runtimeTranslate: DictionaryRuntimeTranslate;
    lifecycle?: LifecycleParam<
      DictionaryKey,
      DictionaryPath,
      DictionaryValue,
      DictionaryEntry
    > &
      DictionaryObjectLifecycleParam;
  }) {
    super(init, lifecycle);
    this._runtimeTranslate = runtimeTranslate;
    this.onHitObj = lifecycle?.onHitObj;
    this.onMissObj = lifecycle?.onMissObj;
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

  public getObj(key: DictionaryKey): DictionaryValue | undefined {
    const value = this.getCache(key);
    if (value === undefined) {
      return undefined;
    }
    const outputValue = structuredClone(value);

    if (this.onHitObj) {
      this.onHitObj({
        inputKey: key,
        cacheKey: this.genKey(key),
        cacheValue: value as DictionaryValue,
        outputValue,
      });
    }
    return outputValue;
  }

  public setObj(key: DictionaryKey, value: DictionaryValue): void {
    this.setCache(this.genKey(key), structuredClone(value));
  }

  public async missObj(
    key: DictionaryKey,
    sourceObject: DictionaryValue
  ): Promise<DictionaryValue> {
    const sourceEntry = getDictionaryEntry(sourceObject);
    if (sourceEntry !== undefined) {
      const entry = await this.miss(key, sourceEntry);
      return getDictionaryValue(entry);
    }

    if (!isDictionaryValue(sourceObject)) {
      throw new Error(
        `DictionaryCache missObj source value ${key} is not a dictionary object`
      );
    }

    const translatedEntries = await Promise.all(
      Object.entries(sourceObject).map(async ([childKey, childSource]) => {
        const childPath = key ? `${key}.${childKey}` : childKey;
        return [childKey, await this.missObj(childPath, childSource)] as const;
      })
    );
    const translatedObject = Object.fromEntries(
      translatedEntries
    ) as Dictionary;
    this.setObj(key, translatedObject);
    return translatedObject;
  }

  /**
   * Miss the cache
   * @param key - The dictionary key
   * @returns The dictionary value
   */
  public async miss(
    key: DictionaryKey,
    sourceEntry: DictionaryEntry
  ): Promise<DictionaryEntry> {
    const value = await this.missCache(key, sourceEntry);
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
  protected fallback(
    key: DictionaryKey,
    sourceEntry: DictionaryEntry
  ): Promise<DictionaryValue> {
    return this._runtimeTranslate(key, sourceEntry);
  }
}
