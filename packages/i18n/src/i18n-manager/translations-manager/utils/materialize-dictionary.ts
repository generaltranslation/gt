import { DictionarySourceNotFoundError } from './DictionarySourceNotFoundError';
import {
  cloneDictionaryValue,
  getDictionaryEntry,
  isDictionaryObject,
} from './dictionary-helpers';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryKey,
  DictionaryValue,
} from './types/dictionary';

export type TranslateDictionaryEntry = (
  key: DictionaryKey,
  sourceEntry: DictionaryEntry
) => Promise<DictionaryValue>;

export async function materializeDictionaryValue({
  key,
  sourceValue,
  targetValue,
  translateEntry,
}: {
  key: DictionaryKey;
  sourceValue: DictionaryValue;
  targetValue: DictionaryValue | undefined;
  translateEntry: TranslateDictionaryEntry;
}): Promise<DictionaryValue> {
  if (getDictionaryEntry(targetValue) !== undefined) {
    return cloneDictionaryValue(targetValue as DictionaryValue);
  }

  if (isDictionaryObject(targetValue) && !isDictionaryObject(sourceValue)) {
    return cloneDictionaryValue(targetValue);
  }

  const sourceEntry = getDictionaryEntry(sourceValue);
  if (sourceEntry !== undefined) {
    return await translateEntry(key, sourceEntry);
  }

  if (!isDictionaryObject(sourceValue)) {
    throw new DictionarySourceNotFoundError(key);
  }

  const targetDictionary = isDictionaryObject(targetValue) ? targetValue : {};
  const keys = new Set([
    ...Object.keys(sourceValue),
    ...Object.keys(targetDictionary),
  ]);
  const entries = await Promise.all(
    Array.from(keys).map(async (childKey) => {
      const childSource = sourceValue[childKey];
      if (childSource === undefined) {
        return [
          childKey,
          cloneDictionaryValue(targetDictionary[childKey]),
        ] as const;
      }

      return [
        childKey,
        await materializeDictionaryValue({
          key: key ? `${key}.${childKey}` : childKey,
          sourceValue: childSource,
          targetValue: targetDictionary[childKey],
          translateEntry,
        }),
      ] as const;
    })
  );

  return Object.fromEntries(entries) as Dictionary;
}
