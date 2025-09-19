import { Dictionary, Translations } from '../types/types';
import { getDictionaryEntry } from './getDictionaryEntry';
import getEntryAndMetadata from './getEntryAndMetadata';
import { injectEntry } from './injectEntry';
import { isDictionaryEntry } from './isDictionaryEntry';

/**
 * @description Injects translations into a dictionary
 * @param dictionary - The dictionary to inject translations into
 * @param translationsDictionary - The translations to inject into the dictionary
 * @param translations - The translations to inject into the dictionary
 * @param id - The id of the dictionary to inject translations into
 */
export function injectTranslations(
  dictionary: Dictionary,
  translationsDictionary: Dictionary,
  translations: Translations,
  missingTranslations: {
    source: string | null;
    metadata: { $id: string; $context?: string; $_hash: string };
  }[],
  prefixToRemove: string = ''
): { dictionary: Dictionary; updateDictionary: boolean } {
  let updateDictionary = false;
  const prefixToRemoveArray = prefixToRemove ? prefixToRemove.split('.') : [];
  missingTranslations.forEach(({ metadata }) => {
    const { $_hash, $id } = metadata;

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
    // Fall back to what was already in the translations dictionary
    const value = translations[$_hash] || dictTransEntry;
    if (!value) {
      return;
    }

    injectEntry(value as string, translationsDictionary, id, dictionary);
    updateDictionary = true;
  });
  return {
    dictionary: translationsDictionary as Dictionary,
    updateDictionary,
  };
}
