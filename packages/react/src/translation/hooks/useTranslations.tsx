import React from 'react';
import useGTContext from '../../provider/GTContext';
import { DictionaryTranslationOptions } from '../../types/types';

/**
 * Gets the dictionary access function `t` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslations('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useTranslations();
 * console.log(t('hello')); // Translates item 'hello'
 */
export default function useTranslations(
  id?: string
): (id: string, options?: DictionaryTranslationOptions) => string {
  // Create a prefix for translation keys if an id is provided
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  // Get the translation context
  const { _internaluseTranslationsFunction } = useGTContext(
    `useTranslations('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
  );

  /**
   * @description A function that translates a dictionary entry based on its `id` and options.
   * @param {string} id The identifier of the dictionary entry to translate.
   * @param {DictionaryTranslationOptions} options for translating strings.
   * @returns The translated version of the dictionary entry.
   *
   * @example
   * t('greetings.greeting1'); // Translates item in dictionary under greetings.greeting1
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
   * t('greetings.greeting2', { variables: { name: 'John' } });
   */
  function t(id: string, options: DictionaryTranslationOptions = {}): string {
    const prefixedId = getId(id);
    return _internaluseTranslationsFunction(prefixedId, options);
  }

  return t;
}
