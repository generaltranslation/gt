import React from "react";
import useGTContext from "../provider/GTContext";
import { createNoEntryWarning } from "../messages/createMessages";

/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = useGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export default function useGT(
    id: string = ''
): (
    id: string,
    options?: Record<string, any>
) => React.ReactNode {

    // Create a prefix for translation keys if an id is provided
    const getId = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    // Get the translation context
    const { translateDictionaryEntry } = useGTContext(
        `useGT('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
    );
   
    /**
    * Translates a dictionary item based on its `id` and options.
    * 
    * @param {string} [id=''] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    * 
    * @returns {React.ReactNode}
    */
    function t(
        id: string = '', 
        options: Record<string, any> = {}
    ): React.ReactNode {
        const prefixedId = getId(id);
        if (translateDictionaryEntry) {
            const translation = translateDictionaryEntry(prefixedId, options);
            if (translation === undefined || translation === null) console.warn(createNoEntryWarning(id, prefixedId))
            return translation;
        }
    };

    return t;
}