import {
  DictionaryTranslationOptions,
  getDictionaryEntry,
  getEntryAndMetadata,
  isValidDictionaryEntry
} from 'gt-react/internal';

import getGT from './getGT';
import getDictionary from '../../dictionary/getDictionary';
import { createNoEntryWarning } from '../../errors/createErrors';

/**
 * Returns the dictionary access function `d()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const d = await getDict('user');
 * console.log(d('name')); // Translates item 'user.name'
 *
 * const d = await getDict();
 * console.log(d('hello')); // Translates item 'hello'
 */
export default async function getDict(id?: string): Promise<
  (
    id: string,
    options?: DictionaryTranslationOptions
  ) => string
> {

  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  const dictionary = getDictionary() || {};

  const t = await getGT();

  // ---------- THE d() METHOD ---------- //

  /**
   * @description A function that translates a dictionary entry based on its `id` and options.
   * @param {string} id The identifier of the dictionary entry to translate.
   * @param {DictionaryTranslationOptions} options
   * @returns The translated version of the dictionary entry.
   *
   * @example
   * d('greetings.greeting1'); // Translates item in dictionary under greetings.greeting1
   *
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
  const d = (
    id: string,
    options: DictionaryTranslationOptions = {}
  ): string => {
    id = getId(id);
    const value = getDictionaryEntry(dictionary, id);
    const valueIsValid = isValidDictionaryEntry(value);
    if (!valueIsValid) {
        console.error(createNoEntryWarning(id))
        return '';
    }
    const { entry, metadata } = getEntryAndMetadata(value);
    return t(entry, {
      ...metadata,
      ...options,
      id
    })
  };

  return d;
}
