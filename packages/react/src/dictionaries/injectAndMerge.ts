import { Dictionary, DictionaryEntry } from '../types/types';
import { getDictionaryEntry } from './getDictionaryEntry';
import { getSubtree } from './getSubtree';
import { get, set } from './indexDict';
import { isDictionaryEntry } from './isDictionaryEntry';
import mergeDictionaries from './mergeDictionaries';

/**
 * @description Given a subtree and a dictionary, injects the subtree into the dictionary at the given id
 * @param dictionary - The dictionary to inject the subtree into
 * @param subtree - The subtree to inject into the dictionary
 * @param id - The id of the subtree to inject into the dictionary
 */
export function injectAndMerge(
  dictionary: Dictionary,
  subtree: Dictionary,
  id: string
) {
  const dictionarySubtree = getSubtree({ dictionary, id });
  if (!dictionarySubtree) {
    // TODO: circle back
    throw new Error('Dictionary subtree is undefined');
  }
  if (isDictionaryEntry(dictionarySubtree)) {
    throw new Error('Cannot inject and merge a dictionary entry');
  }
  const mergedSubtree = mergeDictionaries(
    dictionarySubtree as Dictionary,
    subtree
  );
  // Inject the merged subtree into the dictionary
  return injectSubtree(dictionary, mergedSubtree, id);
}

function injectSubtree(
  dictionary: Dictionary,
  subtree: Dictionary,
  id: string
) {
  const dictionarySubtree = getDictionaryEntry(dictionary, id);
  if (!dictionarySubtree) {
    throw new Error('Dictionary subtree is undefined');
  }
  if (isDictionaryEntry(dictionarySubtree)) {
    throw new Error('Cannot inject and merge a dictionary entry');
  }
  const ids = id.split('.');
  const shortenedId = ids.slice(0, -1);
  const lastId = ids[ids.length - 1];
  let current: Dictionary | DictionaryEntry = dictionary;
  shortenedId.forEach((id) => {
    current = get(current as Dictionary, id);
  });
  set(current as Dictionary, lastId, subtree);
  return dictionary;
}
