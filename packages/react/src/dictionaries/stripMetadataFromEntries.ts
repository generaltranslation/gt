import { Dictionary } from '../types/types';
import getEntryAndMetadata from './getEntryAndMetadata';
import { isDictionaryEntry } from './isDictionaryEntry';
import { set } from './indexDict';

/**
 * @description Iterate over tree and remove metadata leaving just the entry
 */
export function stripMetadataFromEntries(dictionary: Dictionary): Dictionary {
  let result: Dictionary = {};
  if (Array.isArray(dictionary)) {
    result = [];
  }
  Object.entries(dictionary).forEach(([key, value]) => {
    if (isDictionaryEntry(value)) {
      const { entry } = getEntryAndMetadata(value);
      set(result, key, entry);
    } else {
      set(result, key, stripMetadataFromEntries(value));
    }
  });
  return result;
}
