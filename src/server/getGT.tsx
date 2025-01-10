import { extractEntryMetadata, flattenDictionary, renderDefaultChildren, renderTranslatedChildren } from "gt-react/internal";
import T from "./inline/T";
import getDictionary, { getDictionaryEntry } from "../dictionary/getDictionary";
import { getLocale } from "../server";
import getI18NConfig from "../config/getI18NConfig";
import { renderContentToString, splitStringToContent } from "generaltranslation";
import getMetadata from "../request/getMetadata";
import renderVariable from "./rendering/renderVariable";
import { createDictionarySubsetError, createNoEntryWarning } from "../errors/createErrors";
import React, { isValidElement } from "react";
import { Content, DictionaryEntry } from "gt-react/dist/types/types";

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
    options?: Record<string, any>
) => any> {

    const getId = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    const I18NConfig = getI18NConfig();
    const defaultLocale = I18NConfig.getDefaultLocale();
    const locale = await getLocale();
    const translationRequired = I18NConfig.requiresTranslation(locale);

    let filteredTranslations: Record<string, any> = {};

    if (translationRequired) {

        let translationsPromise = I18NConfig.getTranslations(locale);
        const additionalMetadata = await getMetadata();
        const renderSettings = I18NConfig.getRenderSettings();
        
        // Flatten dictionaries for processing while waiting for translations
        const dictionarySubset = (id ? getDictionaryEntry(id) : getDictionary()) || {};
        if (typeof dictionarySubset !== 'object' || Array.isArray(dictionarySubset))
            throw new Error(createDictionarySubsetError(id ?? '', "getGT"));
        const dictionaryEntries = flattenDictionary(dictionarySubset);

        const translations = await translationsPromise;

        // Translate all strings in advance
        await Promise.all(
            Object.entries(dictionaryEntries ?? {}).map(async ([suffix, dictionaryEntry]) => {
                
                // Get the entry from the dictionary
                let { entry, metadata } = extractEntryMetadata(dictionaryEntry);
                if (typeof entry !== 'string') return; 

                const contentArray = splitStringToContent(entry);

                // Serialize and hash
                const entryId = getId(suffix);
                const [_, hash] = I18NConfig.serializeAndHash(
                    contentArray,
                    metadata?.context,
                    entryId
                );
            
                // If a translation already exists, add it to the translations
                const translation = translations[entryId]?.[hash];
                if (translation) return filteredTranslations[entryId] = translation; // NOTHING MORE TO DO

                // ----- TRANSLATE STRING ----- // 

                const translationPromise = I18NConfig.translateContent({
                    source: contentArray,
                    targetLocale: locale,
                    options: { id: entryId, hash, ...additionalMetadata },
                });
                if (renderSettings.method !== "subtle") {
                    return filteredTranslations[entryId] = await translationPromise;
                }
            })
        );
    }

    return (
        id: string, 
        options?: Record<string, any>
    ): React.JSX.Element | string | undefined => {

        id = getId(id);

        // Get entry
        const dictionaryEntry = getDictionaryEntry(id);
        if (
            dictionaryEntry === undefined || dictionaryEntry === null || 
            (typeof dictionaryEntry === 'object' && !isValidElement(dictionaryEntry) && !Array.isArray(dictionaryEntry)) 
        )
        {
            console.warn(createNoEntryWarning(id))
            return undefined;
        };

        let { entry, metadata } = extractEntryMetadata(dictionaryEntry as DictionaryEntry);

        // Get variables and variable options
        let variables = options; 
        let variablesOptions = metadata?.variablesOptions;

        if (typeof entry === 'string') {
            const contentArray = filteredTranslations[id] || splitStringToContent(entry);
            return renderContentToString(
                contentArray, [locale, defaultLocale], variables, variablesOptions
            )
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
        );
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
    options?: Record<string, any>
) => React.JSX.Element {

    const getId = (suffix: string) => {
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
        options: Record<string, any> = {}
    ): React.JSX.Element {

        id = getId(id);

        // Get entry
        const dictionaryEntry = getDictionaryEntry(id);
        if (
            dictionaryEntry === undefined || dictionaryEntry === null || 
            (typeof dictionaryEntry === 'object' && !isValidElement(dictionaryEntry) && !Array.isArray(dictionaryEntry)) 
        )
        {
            console.warn(createNoEntryWarning(id))
            return <React.Fragment />;
        };

        let { entry, metadata } = extractEntryMetadata(dictionaryEntry as DictionaryEntry);

        // Get variables and variable options
        let variables = options; 
        let variablesOptions = metadata?.variablesOptions;

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