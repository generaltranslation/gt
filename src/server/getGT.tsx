import { extractEntryMetadata, flattenDictionary, renderDefaultChildren, renderTranslatedChildren } from "gt-react/internal";
import T from "./inline/T";
import getDictionary, { getDictionaryEntry } from "../dictionary/getDictionary";
import { getLocale } from "../server";
import getI18NConfig from "../config/getI18NConfig";
import { renderContentToString, splitStringToContent } from "generaltranslation";
import getMetadata from "../request/getMetadata";
import renderVariable from "./rendering/renderVariable";
import { createNoEntryWarning } from "../errors/createErrors";

/**
 * Returns the translation function `t()`, which is used to translate an item from the dictionary.
 *
 * @param {string} [id] - Optional prefix to prepend to the translation keys.
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = await getGT('user');
 * console.log(t('name')); // Translates item 'user.name'
 *
 * const t = await getGT();
 * console.log(t('hello')); // Translates item 'hello'
 */
export async function getGT(id?: string): Promise<(
    id: string, 
    options?: Record<string, any>, 
    f?: Function
) => any> {

    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    const I18NConfig = getI18NConfig();
    const defaultLocale = I18NConfig.getDefaultLocale();
    const locale = await getLocale();
    const translationRequired = I18NConfig.requiresTranslation(locale);

    let translations: Record<string, any> = {};

    if (translationRequired) {

        let translationsPromise = I18NConfig.getTranslations(locale);
        const additionalMetadata = await getMetadata();
        const renderSettings = I18NConfig.getRenderSettings();
        
        // Flatten dictionaries for processing while waiting for translations
        const dictionaryEntries = flattenDictionary(id ? getDictionaryEntry(id) : getDictionary());

        translations = { ...(await translationsPromise) };

        await Promise.all(
            Object.entries(dictionaryEntries).map(async ([suffix, dictionaryEntry]) => {
                
                // Get the entry from the dictionary
                const entryID = getID(suffix);
                let { entry, metadata } = extractEntryMetadata(dictionaryEntry);
                if (typeof entry === 'undefined') return; 
    
                // If entry is a function, execute it
                if (typeof entry === 'function') {
                    entry = entry({});
                    metadata = { ...metadata, isFunction: true };
                }

                // Tag the result of entry
                const taggedEntry = I18NConfig.addGTIdentifier(entry, id);
    
                // Set dictionary entry to be passed to the client
                const [entryAsObjects, key] = I18NConfig.serializeAndHash(
                    taggedEntry,
                    metadata?.context,
                    entryID
                );
            
                // If a translation already exists, add it to the translations
                const translation = translations[entryID];
                if (translation && translation.k === key) {
                    return; // NOTHING MORE TO DO
                }
                
                if (typeof taggedEntry === 'string') {
                    const translationPromise = I18NConfig.translateContent({
                      source: splitStringToContent(taggedEntry),
                      targetLocale: locale,
                      options: { id: entryID, hash: key, ...additionalMetadata },
                    });
                    if (renderSettings.method !== "subtle") 
                      return translations[entryID] = {
                          t: await translationPromise,
                          k: key
                    };
                    return; // NOTHING MORE TO DO 
                };
    
                const translationPromise = I18NConfig.translateChildren({
                    source: entryAsObjects,
                    targetLocale: locale,
                    metadata: {
                      id: entryID,
                      hash: key,
                      ...additionalMetadata,
                      ...(renderSettings.timeout && { timeout: renderSettings.timeout }),
                    },
                });
                if (renderSettings.method !== "subtle") 
                    return translations[entryID] = {
                        t: await translationPromise,
                        k: key
                    };
                return; // NOTHING MORE TO DO 
    
            })
        );
    }

    return (
        id: string, 
        options?: Record<string, any>,
        f?: Function
    ): JSX.Element | string | undefined => {

        id = getID(id);

        // Get entry
        let { entry, metadata } = extractEntryMetadata(
            getDictionaryEntry(id)
        );

        if (!entry) {
            console.warn(createNoEntryWarning(id));
            return undefined;
        }

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

        // Tag the result of entry
        const taggedEntry = I18NConfig.addGTIdentifier(entry, id);

        if (typeof taggedEntry === 'string')
            return renderContentToString(
                translations[id]?.t || taggedEntry,
                [locale, defaultLocale],
                variables, variablesOptions
            );

        if (!translationRequired)
            return renderDefaultChildren({
                children: taggedEntry, defaultLocale,
                variables, variablesOptions, renderVariable
            }) as string | JSX.Element | undefined;

        if (translations[id]?.t) {
            return renderTranslatedChildren({
                source: taggedEntry, target: translations[id].t,
                variables, variablesOptions, locales: [locale, defaultLocale], 
                renderVariable
            }) as string | JSX.Element | undefined;
        }
        

    }
}


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
export function useElement(id?: string): (
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
            console.warn(createNoEntryWarning(id));
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