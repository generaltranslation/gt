import React from 'react';
import useGTContext from '../../provider/GTContext';
import { createNoEntryWarning } from '../../messages/createMessages';
import { DictionaryTranslationOptions } from '../../types/types';

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
  id: string
): (id: string, options?: DictionaryTranslationOptions) => React.ReactNode {
  
  // Create a prefix for translation keys if an id is provided
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  // Get the translation context
  const { _internalUseDictFunction } = useGTContext(
    `useGT('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
  );

  /**
   * @description A function that translates a dictionary entry based on its `id` and options.
   * @param {string} id The identifier of the dictionary entry to translate.
   * @param {DictionaryTranslationOptions} options for translating strings.
   * @returns The translated version of the dictionary entry.
   *
   * @example
   * d('greetings.greeting1'); // Translates item in dictionary under greetings.greeting1
   *x
   * @example
   * // dictionary entry
   * {
   *  greetings: {
   *    greeting2: "Hello, {name}!"
   *  }
   * }
   *
   * // Translates item in dictionary under greetings.greeting2 and replaces {name} with 'John'
   * d('greetings.greeting2', { variables: { name: 'John' } });
   */
  function d(
    id: string,
    options: DictionaryTranslationOptions = {}
  ): string {
    // Get the prefixed ID
    const prefixedId = getId(id);
    return (_internalUseDictFunction as any)(prefixedId, options);
  }

  return d;
}
