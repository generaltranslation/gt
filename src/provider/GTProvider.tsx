// 
import React from "react";
import { addGTIdentifier, flattenDictionary, hashReactChildrenObjects, writeChildrenAsObjects, extractEntryMetadata, primitives } from "gt-react/internal";
import { ReactNode } from "react";
import getI18NConfig from "../utils/getI18NConfig";
import getLocale from '../request/getLocale';
import getMetadata from '../request/getMetadata';
import { splitStringToContent } from "generaltranslation";
import getDictionary, { getDictionaryEntry } from "../dictionary/getDictionary";
import renderDefaultChildren from "../server/rendering/renderDefaultChildren";
import ClientProvider from "./ClientProvider";

/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 * 
 * @returns {JSX.Element} The provider component for General Translation context.
*/
export default async function GTProvider({
    children, id
}: {
    children?: ReactNode,
    id?: string
}) {

    const I18NConfig = getI18NConfig()

    const getID = (suffix: string) => {
        return id ? `${id}.${suffix}` : suffix;
    }

    const locale = await getLocale();
    const additionalMetadata = await getMetadata();
    const defaultLocale = I18NConfig.getDefaultLocale();
    const renderSettings = I18NConfig.getRenderSettings();

    let dictionary: Record<string, any> = {};
    let translations: Record<string, any> = {};

    const translationRequired = I18NConfig.requiresTranslation(locale)

    let existingTranslations: Record<string, any> = 
        translationRequired ? await I18NConfig.getTranslations(locale) : {}

    await Promise.all(Object.entries(flattenDictionary(id ? getDictionaryEntry(id) : getDictionary())).map(async ([suffix, dictionaryEntry]) => {

        const entryID = getID(suffix);

        let { entry, metadata } = extractEntryMetadata(dictionaryEntry);

        if (typeof entry === 'function') {
            entry = entry({});
            metadata = { ...metadata, isFunction: true };
        }

        const taggedEntry = addGTIdentifier(entry, entryID);

        dictionary[entryID] = [taggedEntry, metadata];
        
        if (!translationRequired || !entry) return;

        const entryAsObjects = writeChildrenAsObjects(taggedEntry);

        const key: string = hashReactChildrenObjects(metadata?.context ? [entryAsObjects, metadata.context] : entryAsObjects);

        const translation = existingTranslations?.[entryID];

        if (translation && translation.k === key) {
            return translations[entryID] = translation;
        }

        if (typeof taggedEntry === 'string') {
            const translationPromise = I18NConfig.translate({ content: splitStringToContent(taggedEntry), targetLanguage: locale, options: { id: entryID, hash: key, ...additionalMetadata } });
            return renderSettings.method !== "subtle" 
                ? translations[entryID] = { t: await translationPromise, k: key } :
                undefined
            ;
        }

        const translationPromise = I18NConfig.translateChildren({ 
            children: entryAsObjects, 
            targetLanguage: locale, 
            metadata: { id: entryID, hash: key, ...additionalMetadata, ...(renderSettings.timeout && { timeout: renderSettings.timeout }) } 
        });

        let loadingFallback;
        let errorFallback;

        if (renderSettings.method === "skeleton") {
            loadingFallback = <React.Fragment key={`skeleton_${entryID}`} />
        }
        else if (renderSettings.method === "replace") {
            loadingFallback = renderDefaultChildren({
                children: taggedEntry, defaultLocale
            })
        }

        return translations[entryID] = { 
            promise: translationPromise,
            loadingFallback, errorFallback
        }

    }));

    return (
        <ClientProvider
            dictionary={dictionary}
            translations={{...existingTranslations, ...translations}}
            locale={locale}
            defaultLocale={defaultLocale}
            translationRequired={translationRequired}
        >
            {children}
        </ClientProvider>
    )

}