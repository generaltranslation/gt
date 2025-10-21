import { Dictionary, DictionaryEntry } from '../types-dir/types';
/**
 * @description A function that gets a value from a dictionary, only one level
 * @param dictionary - dictionary to get the value from
 * @param id - id of the value to get
 */
export function get(dictionary: Dictionary, id: string | number) {
  if (dictionary == null) {
    throw new Error('Cannot index into an undefined dictionary');
  }
  if (Array.isArray(dictionary)) {
    return dictionary[id as number];
  }
  return dictionary[id as string];
}

/**
 * @description A function that sets a value in a dictionary
 * @param dictionary - dictionary to set the value in
 * @param id - id of the value to set
 * @param value - value to set
 */
export function set(
  dictionary: Dictionary,
  id: string | number,
  value: Dictionary | DictionaryEntry
) {
  if (Array.isArray(dictionary)) {
    dictionary[id as number] = value;
  } else {
    (dictionary as any)[id as string] = value;
  }
}
