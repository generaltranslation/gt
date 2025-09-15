import { Dictionary, DictionaryEntry } from '../types/types';
import { getDictionaryEntry } from './getDictionaryEntry';
import getEntryAndMetadata from './getEntryAndMetadata';
import { isDictionaryEntry } from './isDictionaryEntry';

/**
 * Safely resolves a dictionary entry from a Dictionary or DictionaryEntry
 * @param tree - The Dictionary or DictionaryEntry to resolve from
 * @param id - The ID to look up in the dictionary
 * @returns The resolved DictionaryEntry or undefined if not found
 */
function resolveDictionaryEntry(
  tree: Dictionary | DictionaryEntry,
  id: string
): Dictionary | DictionaryEntry | undefined {
  // If it's a DictionaryEntry, return it
  if (isDictionaryEntry(tree)) {
    return tree;
  }
  // Check if tree is a Dictionary before calling getDictionaryEntry
  if (typeof tree === 'object' && !Array.isArray(tree)) {
    return getDictionaryEntry(tree, id);
  }
  return undefined;
}

/**
 * Given a translated dictionary and an original dictionary, create a list of {source, metadata}[]
 * objects listing the untranslated entries.
 * @param subtree
 * @param subTreeTranslation
 * @returns {Dictionary | DictionaryEntry} A dictionary or dictionary entry with the untranslated entries.
 */
export function getUntranslatedEntries(
  tree: Dictionary | DictionaryEntry,
  transaltedTree: Dictionary | DictionaryEntry | undefined,
  id: string = ''
): {
  source: string;
  metadata: { $id?: string; $context?: string };
}[] {
  const untranslatedEntries: {
    source: string;
    metadata: { $id?: string; $context?: string };
  }[] = [];
  // If the translated tree is undefined, return an empty array
  if (transaltedTree === undefined) {
    return untranslatedEntries;
  }

  // Iterate over the tree
  for (const [key, subtree] of Object.entries(tree)) {
    const $id = `${id ? `${id}.` : ''}${key}`;
    if (isDictionaryEntry(subtree)) {
      // Resolve the translated entry
      const translatedEntry = resolveDictionaryEntry(transaltedTree, $id);

      // Check if the translated entry is undefined (e.g. not translated)
      if (translatedEntry === undefined) {
        const { entry, metadata } = getEntryAndMetadata(subtree);
        // Track the untranslated entry
        untranslatedEntries.push({
          source: entry,
          metadata: { $id, $context: metadata?.$context },
        });
      }
    } else {
      // Resolve the translated entry
      untranslatedEntries.push(
        ...getUntranslatedEntries(subtree, transaltedTree, $id)
      );
    }
  }
  return untranslatedEntries;
}
