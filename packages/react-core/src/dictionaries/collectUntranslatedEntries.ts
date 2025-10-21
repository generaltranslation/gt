import { Dictionary } from '../types-dir/types';
import getEntryAndMetadata from './getEntryAndMetadata';
import { get } from './indexDict';
import { isDictionaryEntry } from './isDictionaryEntry';

/**
 * @description Collects all untranslated entries from a dictionary
 * @param dictionary - The dictionary to collect untranslated entries from
 * @param translationsDictionary - The translated dictionary to compare against
 * @param id - The id of the dictionary to collect untranslated entries from
 * @returns An array of untranslated entries
 */
export function collectUntranslatedEntries(
  dictionary: Dictionary,
  translationsDictionary: Dictionary,
  id: string = ''
): {
  source: string;
  metadata: { $id: string; $context?: string; $_hash: string };
}[] {
  const untranslatedEntries: {
    source: string;
    metadata: { $id: string; $context?: string; $_hash: string };
  }[] = [];
  Object.entries(dictionary).forEach(([key, value]) => {
    const wholeId = id ? `${id}.${key}` : key;
    if (isDictionaryEntry(value)) {
      const { entry, metadata } = getEntryAndMetadata(value);

      if (!get(translationsDictionary, key)) {
        untranslatedEntries.push({
          source: entry,
          metadata: {
            $id: wholeId,
            $context: metadata?.$context,
            $_hash: metadata?.$_hash || '',
          },
        });
      }
    } else {
      untranslatedEntries.push(
        ...collectUntranslatedEntries(
          value,
          (get(translationsDictionary, key) ||
            (Array.isArray(value) ? [] : {})) as Dictionary,
          wholeId
        )
      );
    }
  });
  return untranslatedEntries;
}
