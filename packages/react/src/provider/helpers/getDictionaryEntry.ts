import React from 'react';
import {
  Dictionary,
  DictionaryEntry,
  FlattenedDictionary,
} from '../../types/types';
import { createLibraryNoEntryWarning } from '../../messages/createMessages';

export default function getDictionaryEntry<
  T extends Dictionary | FlattenedDictionary,
>(
  dictionary: T,
  id: string
): T extends FlattenedDictionary
  ? DictionaryEntry | undefined
  : Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  let dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    if (
      typeof current !== 'object' ||
      Array.isArray(current) ||
      React.isValidElement(current)
    ) {
      console.error(createLibraryNoEntryWarning(id));
      return undefined;
    }
    current = (current as Dictionary)[key];
  }
  return current as T extends FlattenedDictionary
    ? DictionaryEntry | undefined
    : Dictionary | DictionaryEntry | undefined;
}
