import {
  cloneDictionaryValue,
  getDictionaryEntry,
  getDictionaryValue,
  getDictionaryValueAtPath,
  isDictionaryObject,
  setDictionaryValueAtPath,
} from './utils/dictionary-helpers';
import { materializeDictionaryValue } from './utils/materialize-dictionary';
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
  DictionaryPath,
  DictionaryValue,
} from './utils/types/dictionary';

export type DictionaryRuntimeTranslate = (
  key: DictionaryKey,
  sourceEntry: DictionaryEntry
) => Promise<string>;

export type DictionaryLoader = (locale: string) => Promise<Dictionary>;

function cloneDictionaryEntry(entry: DictionaryEntry): DictionaryEntry {
  return {
    entry: entry.entry,
    options: structuredClone(entry.options),
  };
}

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

  constructor({
    init,
    runtimeTranslate,
  }: {
    init: Dictionary;
    runtimeTranslate: DictionaryRuntimeTranslate;
  }) {
    this.cache = structuredClone(init);
    this.runtimeTranslate = runtimeTranslate;
  }

  public getEntry(key: DictionaryKey): DictionaryEntry | undefined {
    const value = getDictionaryValueAtPath(this.cache, key);
    const entry = getDictionaryEntry(value);
    if (entry === undefined) {
      return undefined;
    }
    return cloneDictionaryEntry(entry);
  }

  public getValue(key: DictionaryKey): DictionaryValue | undefined {
    const value = getDictionaryValueAtPath(this.cache, key);
    if (value === undefined) {
      return undefined;
    }
    return cloneDictionaryValue(value);
  }

  public setValue(key: DictionaryKey, value: DictionaryValue): void {
    setDictionaryValueAtPath(this.cache, key, cloneDictionaryValue(value));
  }

  public getInternalCache(): Dictionary {
    return cloneDictionaryValue(this.cache);
  }

  public update(dictionary: Dictionary): void {
    mergeDictionary(this.cache, dictionary);
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
          return cloneDictionaryEntry(entry);
        }
      );
      this.pendingTranslations.set(key, translationPromise);
    }

    try {
      return cloneDictionaryEntry(await translationPromise);
    } finally {
      this.pendingTranslations.delete(key);
    }
  }
}

function mergeDictionary(target: Dictionary, source: Dictionary): void {
  for (const [key, value] of Object.entries(source)) {
    const targetValue = target[key];
    if (isDictionaryObject(targetValue) && isDictionaryObject(value)) {
      mergeDictionary(targetValue, value);
    } else {
      target[key] = cloneDictionaryValue(value);
    }
  }
}
