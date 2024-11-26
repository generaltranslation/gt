import React, { isValidElement } from "react";
import useGTContext from "../provider/GTContext";

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
export function useGT(
    id: string = ''
): (
    id: string,
    options?: Record<string, any>,
    f?: Function
) => JSX.Element | string | undefined {

    // Create a prefix for translation keys if an id is provided
    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    // Get the translation context
    const { translate } = useGTContext(
        `useGT('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
    );
   
    /**
    * Translates a dictionary item based on its `id` and options.
    * 
    * @param {string} [id=''] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    * @param {Function} [f] - `f` is executed with `options` as parameters, and its result is translated based on the dictionary value of `id`. You likely don't need this parameter unless you are using `gt-next`.
    * 
    * @returns {string | JSX.Element}
    */
    function t(
        id: string = '', 
        options: Record<string, any> = {}, 
        f?: Function
    ): JSX.Element | string | undefined {
        const prefixedID = getID(id);
        if (translate) {
            const translation = translate(prefixedID, options, f);
            if (!translation) console.warn(`t('${id}') finding no translation for dictionary item ${prefixedID} !`);
            return translation;
        }
        return undefined;
    };

    return t;
}

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
export function useElement(
    id: string = ''
): (
    id: string,
    options?: Record<string, any>,
    f?: Function
) => JSX.Element {

    // Create a prefix for translation keys if an id is provided
    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    // Get the translation context
    const { translate } = useGTContext(
        `useElement('${id}'): No context provided. You're trying to get the t() function on the client, which can only be done inside a <GTProvider>.`
    );
   
    /**
    * Translates a dictionary item based on its `id` and options.
    * Always returns a JSX.Element. Returns a fragment if there is no translation.
    * 
    * @param {string} [id=''] - The ID of the item in the dictionary to translate.
    * @param {Record<string, any>} [options={}] - Variables or parameters (e.g., `n`) passed into the translation for dynamic content.
    * @param {Function} [f] - `f` is executed with `options` as parameters, and its result is translated based on the dictionary value of `id`. You likely don't need this parameter unless you are using `gt-next`.
    * 
    * @returns {JSX.Element}
    */
    function t(
        id: string = '', 
        options: Record<string, any> = {}, 
        f?: Function
    ): JSX.Element {
        const prefixedID = getID(id);
        if (translate) {
            const translation = translate(prefixedID, options, f);
            if (!translation) console.warn(`t('${id}') finding no translation for dictionary item ${prefixedID} !`);
            if (!isValidElement(translation)) return <React.Fragment>{translation}</React.Fragment>
            return translation;
        }
        return <React.Fragment />;
    };

    return t;
}

