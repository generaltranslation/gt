import { extractEntryMetadata } from "gt-react/internal";
import T from "./inline/T";
import { getDictionaryEntry } from "../dictionary/getDictionary";
import tx from "./strings/tx";

/**
 * Gets the translation function `t`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export function getGT(id?: string): (
    id: string, 
    options?: Record<string, any>, 
    f?: Function
) => JSX.Element | Promise<string> | undefined {

    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    return (
        id: string, 
        options?: Record<string, any>,
        f?: Function
    ): JSX.Element | Promise<string> | undefined => {

        id = getID(id);

        // Get entry
        let { entry, metadata } = extractEntryMetadata(
            getDictionaryEntry(id)
        );

        // Get variables and variable options
        let variables; let variablesOptions;
        if (options) {
            variables = options;
            if (metadata?.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }

        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        } else if (typeof entry === 'function') {
            entry = entry(options);
        }

        if (!entry) {
            console.warn(`No entry found for id: "${id}"`);
            return undefined;
        }

        if (typeof entry === 'string') {
            return tx(entry, { 
                id, variables, variablesOptions
            });
        }

        return (
            <T 
                id={id}
                variables={variables}
                variablesOptions={variablesOptions}
                {...metadata}
            >
                {entry}
            </T>
        )

    }
}

/**
 * Gets the translation function `t`, which is used to translate a JSX element from the dictionary.
 * For translating strings directly, see `getGT()` or `useGT()`.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = gt('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = gt();
 * console.log(t('hello')); // Translates item 'hello'
 */
export function gt(id?: string): (
    id: string, 
    options?: Record<string, any>, 
    f?: Function
) => JSX.Element {

    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
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
    function t(
        id: string, 
        options: Record<string, any> = {}, 
        f?: Function
    ): JSX.Element {

        id = getID(id);

        // Get entry
        let { entry, metadata } = extractEntryMetadata(
            getDictionaryEntry(id)
        );

        // Get variables and variable options
        let variables; let variablesOptions;
        if (options) {
            variables = options;
            if (metadata?.variablesOptions) {
                variablesOptions = metadata.variablesOptions;
            }
        }

        // Handle if the entry is a function
        if (typeof f === 'function') {
            entry = f(options);
        } else if (typeof entry === 'function') {
            entry = entry(options);
        }

        if (!entry) {
            console.warn(`No entry found for id: "${id}"`);
            return <></>;
        }

        return (
            <T 
                id={id}
                variables={variables}
                variablesOptions={variablesOptions}
                {...metadata}
            >
                {entry}
            </T>
        )
    }

    return t;
}