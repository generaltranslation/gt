import {
  extractEntryMetadata,
  DictionaryEntry,
  isEmptyReactFragment,
} from 'gt-react/internal';
import T from './inline/T';
import { getDictionaryEntry } from '../dictionary/getDictionary';
import {
  createNoEntryWarning,
  dictionaryDisabledError,
} from '../errors/createErrors';
import React, { isValidElement } from 'react';
import getI18NConfig from '../config-dir/getI18NConfig';

/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * **`t()` returns only JSX elements.** For returning strings as well, see `await getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns as JSX
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns as JSX
 */
export default function useElement(
  id?: string
): (id: string, options?: Record<string, any>) => React.JSX.Element {
  const getId = (suffix: string) => {
    return id ? `${id}.${suffix}` : suffix;
  };

  const I18NConfig = getI18NConfig();
  if (!I18NConfig.isDictionaryEnabled()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(dictionaryDisabledError);
      return () => <React.Fragment />;
    } else {
      throw new Error(dictionaryDisabledError);
    }
  }

  /**
   * Translates a dictionary item based on its `id` and options, ensuring that it is a JSX element.
   *
   * @param {string} [id] - The ID of the item in the dictionary to translate.
   * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
   * @param {Function} [f] - Advanced feature. `f` is executed with `options` as parameters, and its result is translated based on the dictionary value of `id`. You likely don't need this parameter unless you using `getGT` on the client-side.
   *
   * @returns {JSX.Element}
   */
  function t(id: string, options: Record<string, any> = {}): React.JSX.Element {
    id = getId(id);

    // Get entry
    const dictionaryEntry = getDictionaryEntry(id);
    if (
      dictionaryEntry === undefined || // no entry found
      (typeof dictionaryEntry === 'object' &&
        !isValidElement(dictionaryEntry) &&
        !Array.isArray(dictionaryEntry)) // make sure is DictionaryEntry, not Dictionary
    ) {
      console.warn(createNoEntryWarning(id));
      return <React.Fragment />;
    }
    let { entry, metadata } = extractEntryMetadata(
      dictionaryEntry as DictionaryEntry
    );

    // Reject empty fragments
    if (isEmptyReactFragment(entry)) {
      console.warn(
        `gt-next warn: Empty fragment found in dictionary with id: ${id}`
      );
      return entry;
    }

    // Get variables and variable options
    let variables = options;
    let variablesOptions = metadata?.variablesOptions;

    // Translate on demand
    return (
      <T
        id={id}
        variables={variables}
        variablesOptions={variablesOptions}
        {...metadata}
      >
        {entry}
      </T>
    );
  }

  return t;
}
