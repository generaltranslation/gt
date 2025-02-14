'use client';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx } from "react/jsx-runtime";
import React, { isValidElement, useCallback, useEffect, useState } from 'react';
import { determineLocale, renderContentToString, splitStringToContent, } from 'generaltranslation';
import { listSupportedLocales } from '@generaltranslation/supported-locales';
import { GTContext } from './GTContext';
import { GTTranslationError, } from '../types/types';
import extractEntryMetadata from './helpers/extractEntryMetadata';
import renderDefaultChildren from './rendering/renderDefaultChildren';
import renderSkeleton from './rendering/renderSkeleton';
import renderTranslatedChildren from './rendering/renderTranslatedChildren';
import { isEmptyReactFragment } from '../utils/utils';
import renderVariable from './rendering/renderVariable';
import useRuntimeTranslation from './runtime/useRuntimeTranslation';
import { localeCookieName } from 'generaltranslation/internal';
// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({ children, dictionary, initialTranslations, translationPromises, locale: _locale, _versionId, defaultLocale, translationRequired, dialectTranslationRequired, locales = listSupportedLocales(), requiredPrefix, renderSettings, projectId, devApiKey, runtimeUrl, translationEnabled, runtimeTranslationEnabled, onLocaleChange = () => { }, cookieName = localeCookieName, }) {
    // ----- TRANSLATIONS STATE ----- //
    /**
     * (a) Cache has already been checked by server at this point
     * (b) All string dictionary translations have been resolved at this point
     * (c) JSX dictionary entries are either (1) resolved (so success/error) or (2) not resolved/not yet requested.
     *     They will NOT be loading at this point.
     */
    const [translations, setTranslations] = useState(devApiKey ? null : initialTranslations);
    // ----- LOCALE STATE ----- //
    // Maintain the locale state
    const [locale, _setLocale] = useState(_locale ? determineLocale(_locale, locales) || '' : '');
    // Check for an invalid cookie and correct it
    useEffect(() => {
        var _a;
        const cookieLocale = (_a = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${cookieName}=`))) === null || _a === void 0 ? void 0 : _a.split('=')[1];
        if (locale &&
            (cookieLocale || cookieLocale === '') &&
            cookieLocale !== locale) {
            document.cookie = `${cookieName}=${locale};path=/`;
        }
    }, [locale]);
    // Set the locale via cookies and refresh the page to reload server-side. Make sure the language is supported.
    const setLocale = (newLocale) => {
        // validate locale
        newLocale = determineLocale(newLocale, locales) || locale || defaultLocale;
        // persist locale
        document.cookie = `${cookieName}=${newLocale};path=/`;
        // set locale
        _setLocale(newLocale);
        // re-render server components
        onLocaleChange();
        // re-render client components
        window.location.reload();
    };
    // ----- TRANSLATION LIFECYCLE ----- //
    // Fetch additional translations and queue them for merging
    useEffect(() => {
        setTranslations((prev) => (Object.assign(Object.assign({}, prev), initialTranslations)));
        let storeResult = true;
        const resolvedTranslations = {};
        (() => __awaiter(this, void 0, void 0, function* () {
            // resolve all translation promises (jsx only)
            yield Promise.all(Object.entries(translationPromises).map((_a) => __awaiter(this, [_a], void 0, function* ([key, promise]) {
                let result;
                try {
                    result = { state: 'success', target: yield promise };
                }
                catch (error) {
                    console.error(error);
                    // set all promise ids to error in translations
                    if (error instanceof GTTranslationError) {
                        result = error.toTranslationError();
                    }
                    else {
                        result = { state: 'error', error: 'An error occured', code: 500 };
                    }
                }
                resolvedTranslations[key] = result;
            })));
            // add resolved translations to state
            if (storeResult) {
                setTranslations((prev) => (Object.assign(Object.assign(Object.assign({}, initialTranslations), prev), resolvedTranslations)));
            }
        }))();
        return () => {
            // cleanup
            storeResult = false;
        };
    }, [initialTranslations, translationPromises]);
    // ----- TRANSLATION METHODS ----- //
    // for dictionaries (strings are actually already resolved, but JSX needs tx still)
    const translateDictionaryEntry = useCallback((id, options = {}) => {
        // ----- SETUP ----- //
        // Get the dictionary entry
        const dictionaryEntry = dictionary[id]; // this is a flattened dictionary
        if ((!dictionaryEntry && dictionaryEntry !== '') || // entry not found
            (typeof dictionaryEntry === 'object' &&
                !isValidElement(dictionaryEntry) &&
                !Array.isArray(dictionaryEntry))) {
            return undefined; // dictionary entry not found
        }
        // Parse the dictionary entry
        const { entry, metadata } = extractEntryMetadata(dictionaryEntry);
        const variables = options;
        const variablesOptions = metadata === null || metadata === void 0 ? void 0 : metadata.variablesOptions;
        // Get the translation entry
        let key = // use hash in dev mode
         process.env.NODE_ENV === 'development' ? (metadata === null || metadata === void 0 ? void 0 : metadata.hash) || id : id;
        const translationEntry = translations === null || translations === void 0 ? void 0 : translations[key];
        // ----- RENDER STRINGS ----- //
        if (typeof entry === 'string') {
            // Reject empty strings
            if (!entry.length) {
                console.warn(`gt-next warn: Empty string found in dictionary with key: ${id}`);
                return entry;
            }
            // Handle fallback cases
            const content = splitStringToContent(entry);
            if (!translationRequired || // no translation required
                !translationEntry || // error behavior: no translation found
                (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) !== 'success' // error behavior: translation did not resolve
            ) {
                return renderContentToString(content, locales, variables, variablesOptions);
            }
            // render translated content
            return renderContentToString(translationEntry.target, [locale, defaultLocale], variables, variablesOptions);
        }
        // ----- RENDER METHODS FOR JSX ----- //
        const taggedChildren = entry;
        // for default/fallback rendering
        const renderDefaultLocale = () => {
            return renderDefaultChildren({
                children: taggedChildren,
                variables,
                variablesOptions,
                defaultLocale,
                renderVariable,
            });
        };
        const renderLoadingDefault = () => {
            if (dialectTranslationRequired) {
                return renderDefaultLocale();
            }
            return renderSkeleton();
        };
        const renderTranslation = (target) => {
            return renderTranslatedChildren({
                source: taggedChildren,
                target,
                variables,
                variablesOptions,
                locales: [locale, defaultLocale],
                renderVariable,
            });
        };
        // ----- RENDER JSX ----- //
        // fallback if:
        if (!translationRequired || // no translation required
            (translations && !translationEntry && !runtimeTranslationEnabled) // cache miss and dev runtime translation disabled (production)
        ) {
            return _jsx(React.Fragment, { children: renderDefaultLocale() });
        }
        // loading behavior: no translation found or translation is loading
        if (!translationEntry || (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'loading') {
            let loadingFallback;
            if (renderSettings.method === 'skeleton') {
                loadingFallback = renderSkeleton();
            }
            else if (renderSettings.method === 'replace') {
                loadingFallback = renderDefaultLocale();
            }
            else {
                // default
                loadingFallback = renderLoadingDefault();
            }
            // The suspense exists here for hydration reasons
            return _jsx(React.Fragment, { children: loadingFallback });
        }
        // error behavior
        if (translationEntry.state === 'error') {
            // Reject empty fragments
            if (isEmptyReactFragment(entry)) {
                console.warn(`gt-next warn: Empty fragment found in dictionary with id: ${id}`);
                return entry;
            }
            return _jsx(React.Fragment, { children: renderDefaultLocale() });
        }
        // render translated content
        return (_jsx(React.Fragment, { children: renderTranslation(translationEntry.target) }));
    }, [dictionary, translations, locale]);
    // For <T> components
    const { translateChildren, translateContent } = useRuntimeTranslation({
        locale: locale,
        versionId: _versionId,
        projectId,
        devApiKey,
        runtimeUrl,
        setTranslations,
        defaultLocale,
        renderSettings,
        runtimeTranslationEnabled,
    });
    return (_jsx(GTContext.Provider, { value: {
            translateDictionaryEntry,
            translateChildren,
            translateContent,
            setLocale,
            locale,
            locales,
            defaultLocale,
            translations,
            translationRequired,
            dialectTranslationRequired,
            renderSettings,
            translationEnabled,
            runtimeTranslationEnabled,
        }, children: (!translationRequired || !translationEnabled || translations) &&
            children }));
}
