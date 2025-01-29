import React, { isValidElement } from "react";
import { createNoEntryWarning } from "../messages/createMessages";
import useGTContext from "../provider/GTContext";
/**
 * `useElement()` hook which gets the translation function `t()` provided by `<GTProvider>`.
 * 
 * **`t()` returns only JSX elements.** For returning strings as well, see `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useElement('user');
 * console.log(t('name')); // Translates item 'user.name', returns it as a JSX element
 *
 * const t = useElement();
 * console.log(t('hello')); // Translates item 'hello', returns it as a JSX element
 */
export default function useElement(
  id: string = ''
): (
  id: string,
  options?: Record<string, any>
) => React.JSX.Element {

  // Create a prefix for translation keys if an id is provided
  const getId = (suffix: string) => {
      return id ? `${id}.${suffix}` : suffix;
  }

  // Get the translation context
  const { translateDictionaryEntry } = useGTContext(
      `useElement('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
  );
 
  /**
  * Translates a dictionary item based on its `id` and options.
  * Always returns a React.JSX.Element. Returns a fragment if there is no translation.
  * 
  * @param {string} [id=''] - The ID of the item in the dictionary to translate.
  * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
  * 
  * @returns {JSX.Element}
  */
  function t(
      id: string = '', 
      options: Record<string, any> = {}
  ): React.JSX.Element {

    const prefixedId = getId(id);
    if (translateDictionaryEntry) {
        const translation = translateDictionaryEntry(prefixedId, options);
        if (!translation) console.warn(createNoEntryWarning(id, prefixedId));
        if (!isValidElement(translation)) return <React.Fragment key={prefixedId}>{translation}</React.Fragment>
        return translation;
    }
    return <React.Fragment key={prefixedId}/>;
  };

  return t;
}

