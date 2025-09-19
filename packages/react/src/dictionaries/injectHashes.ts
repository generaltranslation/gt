import { hashSource } from 'generaltranslation/id';
import { isDictionaryEntry } from './isDictionaryEntry';
import { Dictionary } from '../types/types';
import getEntryAndMetadata from './getEntryAndMetadata';
import { set } from './indexDict';

/**
 * @description Given a dictionary, adds hashes to all dictionary entries
 * @param dictionary - The dictionary to add hashes to
 * @param id - The starting point of dictionary (if subtree)
 */
export function injectHashes(
  dictionary: Dictionary,
  id: string = ''
): { dictionary: Dictionary; updateDictionary: boolean } {
  let updateDictionary = false;
  Object.entries(dictionary).forEach(([key, value]) => {
    const wholeId = id ? `${id}.${key}` : key;
    if (isDictionaryEntry(value)) {
      // eslint-disable-next-line prefer-const
      let { entry, metadata } = getEntryAndMetadata(value);
      if (!metadata?.$_hash) {
        metadata ||= {};
        metadata.$_hash = hashSource({
          source: entry || '',
          ...(metadata?.$context && { context: metadata.$context }),
          id: wholeId,
          dataFormat: 'ICU',
        });
        set(dictionary, key, [entry, metadata]);
        updateDictionary = true;
      }
    } else {
      const { updateDictionary: updateFlag } = injectHashes(value, wholeId);
      updateDictionary = updateDictionary || updateFlag;
    }
  });
  return { dictionary, updateDictionary };
}
