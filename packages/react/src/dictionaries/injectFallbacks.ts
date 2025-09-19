import { Dictionary } from '../types/types';
import { getDictionaryEntry } from './getDictionaryEntry';
import getEntryAndMetadata from './getEntryAndMetadata';
import { injectEntry } from './injectEntry';
import { isDictionaryEntry } from './isDictionaryEntry';

/**
 * @description Injects fallbacks into a dictionary
 * @param dictionary - The dictionary to inject translations into
 * @param translationsDictionary - The translations to inject into the dictionary
 * @param translations - The translations to inject into the dictionary
 * @param id - The id of the dictionary to inject translations into
 */
export function injectFallbacks(
  dictionary: Dictionary,
  translationsDictionary: Dictionary,
  missingTranslations: {
    source: string | null;
    metadata: { $id: string; $context?: string; $_hash: string };
  }[],
  prefixToRemove: string = ''
) {
  const prefixToRemoveArray = prefixToRemove ? prefixToRemove.split('.') : [];
  missingTranslations.forEach(({ source, metadata }) => {
    const { $id } = metadata;

    const id =
      prefixToRemoveArray.length > 0
        ? $id.split('.').slice(prefixToRemoveArray.length).join('.')
        : $id;

    // Look up in translations object
    const translationEntry = getDictionaryEntry(translationsDictionary, id);
    // Look up in translations dictionary
    let dictTransEntry = undefined;
    if (isDictionaryEntry(translationEntry))
      dictTransEntry = getEntryAndMetadata(translationEntry).entry;
    // Fall back to source
    const value = dictTransEntry || source;

    injectEntry(value as string, translationsDictionary, id, dictionary);
  });
  return translationsDictionary;
}
