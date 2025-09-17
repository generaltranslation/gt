import { hashSource } from 'generaltranslation/id';
import { Dictionary, Translations } from '../types/types';
import { isDictionaryEntry } from './isDictionaryEntry';
import getEntryAndMetadata from './getEntryAndMetadata';
import { get, set } from './indexDict';

/**
 * @description
 * Injects translations into tree (falls back to source if no translation is found)
 * Injects the hashes into the source subtree
 * Collects any untranslated entries
 * @param subtree - The subtree to construct the translation subtree from.
 * @param translationSubtree - The translation subtree to construct.
 * @param translations - The translations to construct the translation subtree from.
 * @param id - The id of the subtree to construct the translation subtree from.
 * @returns - The constructed translation subtree, and any untranslated entries.
 */
export function constructTranslationSubtree(
  subtree: Dictionary,
  translationSubtree: Dictionary,
  translations: Translations,
  id: string = ''
): {
  untranslatedEntries: {
    source: string;
    metadata: { $id: string; $context?: string; $_hash: string };
  }[];
} {
  const untranslatedEntriesResult: {
    source: string;
    metadata: { $id: string; $context?: string; $_hash: string };
  }[] = [];
  Object.entries(subtree).forEach(([key, value]) => {
    const wholeId = id ? `${id}.${key}` : key;
    if (isDictionaryEntry(value)) {
      // eslint-disable-next-line prefer-const
      let { entry, metadata } = getEntryAndMetadata(value);
      // Inject the hash into the metadata
      if (!metadata?.$_hash) {
        metadata ||= {};
        metadata.$_hash = hashSource({
          source: entry,
          ...(metadata?.$context && { context: metadata.$context }),
          id: wholeId,
          dataFormat: 'ICU',
        });
        set(subtree, key, [entry, metadata]);
      }
      // Add the untranslated entry to the result
      if (!get(translationSubtree, key)) {
        untranslatedEntriesResult.push({
          source: entry,
          metadata: {
            $id: wholeId,
            $context: metadata?.$context,
            $_hash: metadata?.$_hash,
          },
        });
      }
      // Inject the translation into the result
      const entryToInject =
        (translations[metadata?.$_hash as string] as string) ||
        get(translationSubtree, key) ||
        entry;
      set(translationSubtree, key, entryToInject);
    } else {
      // Continue recursion
      if (!get(translationSubtree, key)) {
        const newTranslationSubtree = Array.isArray(value) ? [] : {};
        set(translationSubtree, key, newTranslationSubtree);
      }
      const { untranslatedEntries: untranslatedChildrenEntriesResult } =
        constructTranslationSubtree(
          value,
          get(translationSubtree, key) as Dictionary,
          translations,
          wholeId
        );
      untranslatedEntriesResult.push(...untranslatedChildrenEntriesResult);
    }
  });
  return {
    untranslatedEntries: untranslatedEntriesResult,
  };
}
