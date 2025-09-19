import { Dictionary, DictionaryEntry } from '../types/types';

/**
 * Type guard function that checks if a value is a DictionaryEntry
 * @param value - The value to check
 * @returns true if the value is a DictionaryEntry, false otherwise
 */
export function isDictionaryEntry(
  value: Dictionary | DictionaryEntry | undefined
): value is DictionaryEntry {
  if (value === undefined) {
    return false;
  }

  // Check if it's an entry
  if (value === null || typeof value !== 'object') {
    return true;
  }

  // Check if it's an array
  if (Array.isArray(value)) {
    // Must have 1 or 2 elements
    if (value.length !== 1 && value.length !== 2) {
      return false;
    }

    // First element must be a string (Entry)
    if (typeof value[0] === 'object' && value[0] !== null) {
      return false;
    }

    // If there's a second element, it must be an object (MetaEntry)
    if (
      value.length === 2 &&
      (typeof value[1] !== 'object' ||
        value[1] === null ||
        (!('$context' in value[1]) && !('$_hash' in value[1])))
    ) {
      return false;
    }

    return true;
  }

  return false;
}
