import { DictionarySourceNotFoundError } from './DictionarySourceNotFoundError';
import {
  assertSafeDictionaryPathSegment,
  cloneDictionaryValue,
  getDictionaryEntry,
  isDictionaryValue,
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

/**
 * Builds the dictionary value for a requested path by combining existing target
 * translations with runtime translations of any source leaves that are missing.
 */
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

  if (isDictionaryValue(targetValue) && !isDictionaryValue(sourceValue)) {
    return cloneDictionaryValue(targetValue);
  }

  const sourceEntry = getDictionaryEntry(sourceValue);
  if (sourceEntry !== undefined) {
    return await translateEntry(key, sourceEntry);
  }

  if (!isDictionaryValue(sourceValue)) {
    throw new DictionarySourceNotFoundError(key);
  }

  const targetDictionary = isDictionaryValue(targetValue) ? targetValue : {};
  const keys = new Set([
    ...Object.keys(sourceValue),
    ...Object.keys(targetDictionary),
  ]);
  const entries = await Promise.all(
    Array.from(keys).map(async (childKey) => {
      const childPath = key ? `${key}.${childKey}` : childKey;
      assertSafeDictionaryPathSegment(childKey, childPath);

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
          key: childPath,
          sourceValue: childSource,
          targetValue: targetDictionary[childKey],
          translateEntry,
        }),
      ] as const;
    })
  );

  return Object.fromEntries(entries) as Dictionary;
}
