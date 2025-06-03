import React from 'react';
import { Dictionary, DictionaryEntry } from '../../types/types';

export function isValidDictionaryEntry(
  value: unknown
): value is DictionaryEntry {
  if (typeof value === 'string') return true;

  if (Array.isArray(value)) {
    if (typeof value?.[0] !== 'string') {
      return false;
    }
    const provisionalMetadata = value?.[1];
    if (typeof provisionalMetadata === 'undefined') return true;
    if (provisionalMetadata && typeof provisionalMetadata === 'object')
      return true;
  }

  return false;
}

export default function getDictionaryEntry<T extends Dictionary>(
  dictionary: T,
  id: string
): Dictionary | DictionaryEntry | undefined {
  let current: Dictionary | DictionaryEntry = dictionary;
  const dictionaryPath = id.split('.');
  for (const key of dictionaryPath) {
    if (
      typeof current !== 'object' ||
      Array.isArray(current) ||
      React.isValidElement(current)
    ) {
      return undefined;
    }
    current = (current as Dictionary)[key];
  }
  return current;
}
