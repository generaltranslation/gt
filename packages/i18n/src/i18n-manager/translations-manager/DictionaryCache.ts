import {
  cloneDictionaryValue,
  getDictionaryEntry,
  getDictionaryValue,
  getDictionaryValueAtPath,
  setDictionaryValueAtPath,
} from './utils/dictionary-helpers';
import { materializeDictionaryValue } from './utils/materialize-dictionary';
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

export type DictionaryLoader = (locale: string) => Promise<Dictionary>;

type DictionaryCacheLifecycle = LifecycleParam<
  DictionaryKey,
  DictionaryPath,
  DictionaryValue,
  DictionaryEntry
> & {
  onDictionaryObjectCacheHit?: LifecycleCallback<
    DictionaryKey,
    DictionaryPath,
    DictionaryValue,
    DictionaryValue
  >;
};

export class DictionaryCache {
  private cache: Dictionary;
  private pendingTranslations = new Map<
    DictionaryKey,
    Promise<DictionaryEntry>
  >();
  private pendingMaterializations = new Map<
    DictionaryKey,
    Promise<DictionaryValue>
  >();
  private runtimeTranslate: DictionaryRuntimeTranslate;
  private lifecycle: DictionaryCacheLifecycle;

  constructor({
    init,
    lifecycle = {},
    runtimeTranslate,
  }: {
    init: Dictionary;
    runtimeTranslate: DictionaryRuntimeTranslate;
    lifecycle?: DictionaryCacheLifecycle;
  }) {
    this.cache = structuredClone(init);
    this.runtimeTranslate = runtimeTranslate;
    this.lifecycle = lifecycle;
  }

  public getEntry(key: DictionaryKey): DictionaryEntry | undefined {
    const value = getDictionaryValueAtPath(this.cache, key);
    const entry = getDictionaryEntry(value);
    if (entry === undefined) {
      return undefined;
    }
    const outputEntry = {
      entry: entry.entry,
      options: structuredClone(entry.options),
    };

    this.lifecycle.onHit?.({
      inputKey: key,
      cacheKey: key,
      cacheValue: value as DictionaryValue,
      outputValue: outputEntry,
    });
    return outputEntry;
  }

  public getValue(key: DictionaryKey): DictionaryValue | undefined {
    const value = getDictionaryValueAtPath(this.cache, key);
    if (value === undefined) {
      return undefined;
    }
    const outputValue = cloneDictionaryValue(value);

    this.lifecycle.onDictionaryObjectCacheHit?.({
      inputKey: key,
      cacheKey: key,
      cacheValue: value as DictionaryValue,
      outputValue,
    });
    return outputValue;
  }

  public setValue(key: DictionaryKey, value: DictionaryValue): void {
    setDictionaryValueAtPath(this.cache, key, cloneDictionaryValue(value));
  }

  public getInternalCache(): Dictionary {
    return cloneDictionaryValue(this.cache);
  }

  public async materializeValue(
    key: DictionaryKey,
    sourceValue: DictionaryValue,
    targetValue = getDictionaryValueAtPath(this.cache, key)
  ): Promise<DictionaryValue> {
    let materializationPromise = this.pendingMaterializations.get(key);
    if (!materializationPromise) {
      materializationPromise = materializeDictionaryValue({
        key,
        sourceValue,
        targetValue,
        translateEntry: async (entryKey, sourceEntry) =>
          getDictionaryValue(
            await this.materializeEntry(entryKey, sourceEntry)
          ),
      }).then((value) => {
        this.setValue(key, value);
        return value;
      });
      this.pendingMaterializations.set(key, materializationPromise);
    }

    try {
      return await materializationPromise;
    } finally {
      this.pendingMaterializations.delete(key);
    }
  }

  public async materializeEntry(
    key: DictionaryKey,
    sourceEntry: DictionaryEntry
  ): Promise<DictionaryEntry> {
    let translationPromise = this.pendingTranslations.get(key);
    if (!translationPromise) {
      translationPromise = this.runtimeTranslate(key, sourceEntry).then(
        (value) => {
          setDictionaryValueAtPath(this.cache, key, value);
          const entry = getDictionaryEntry(value);
          if (entry === undefined) {
            // Never will happen
            throw new Error(
              'DictionaryCache materializeEntry did not return a DictionaryEntry'
            );
          }
          this.lifecycle.onMiss?.({
            inputKey: key,
            cacheKey: key,
            cacheValue: value,
            outputValue: entry,
          });
          return entry;
        }
      );
      this.pendingTranslations.set(key, translationPromise);
    }

    try {
      return await translationPromise;
    } finally {
      this.pendingTranslations.delete(key);
    }
  }
}
