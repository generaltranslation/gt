import React from 'react';
import useGTContext from '../provider/GTContext';
import { createNoEntryWarning } from '../messages/createMessages';
import { TranslationOptions } from '../types/types';

/**
 * Gets the dictionary access function `d` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = useDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = useDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
export default function useDict(
  id: string = ''
): (id: string, options?: TranslationOptions) => React.ReactNode {
  // Create a prefix for translation keys if an id is provided
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  // Get the translation context
  const { getDictionaryEntryTranslation: translateDictionaryEntry } =
    useGTContext(
      `useGT('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
    );

  /**
   * Translates a dictionary item based on its `id` and options.
   *
   * @param {string} [id=''] - The ID of the item in the dictionary to translate.
   * @param {TranslationOptions} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
   *
   * @returns {React.ReactNode}
   */
  function d(
    id: string = '',
    options: TranslationOptions = {}
  ): React.ReactNode {
    // Get the prefixed ID
    const prefixedId = getId(id);

    // Get the translation
    if (translateDictionaryEntry) {
      const translation = translateDictionaryEntry(prefixedId, options);
      if (translation === undefined || translation === null)
        console.warn(createNoEntryWarning(id, prefixedId));
      return translation;
    }
  }

  return d;
}
