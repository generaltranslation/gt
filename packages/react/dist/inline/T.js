var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx } from "react/jsx-runtime";
import React, { useEffect } from 'react';
import useDefaultLocale from '../hooks/useDefaultLocale';
import renderDefaultChildren from '../provider/rendering/renderDefaultChildren';
import { addGTIdentifier, isEmptyReactFragment, writeChildrenAsObjects, } from '../internal';
import useGTContext from '../provider/GTContext';
import renderTranslatedChildren from '../provider/rendering/renderTranslatedChildren';
import { useMemo } from 'react';
import renderVariable from '../provider/rendering/renderVariable';
import { hashJsxChildren } from 'generaltranslation/id';
import renderSkeleton from '../provider/rendering/renderSkeleton';
/**
 * Translation component that handles rendering translated content, including plural forms.
 * Used with the required `id` parameter instead of `const t = useGT()`.
 *
 * @param {string} [id] - Required identifier for the translation string.
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {any} [context] - Additional context used for translation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <T id="welcome_message">
 *  Hello, <Var name="name">{name}</Var>!
 * </T>
 * ```
 *
 * @example
 * ```jsx
 * // Using plural translations:
 * <T id="item_count">
 *  <Plural n={n} singular={<>You have <Num value={n}/> item</>}>
 *      You have <Num value={n}/> items
 *  </Plural>
 * </T>
 * ```
 *
 */
function T(_a) {
    var { children, id } = _a, props = __rest(_a, ["children", "id"]);
    if (!children)
        return undefined;
    if (isEmptyReactFragment(children))
        return _jsx(React.Fragment, {});
    const { variables, variablesOptions } = props;
    const { translations, translationRequired, translationEnabled, runtimeTranslationEnabled, dialectTranslationRequired, translateChildren, renderSettings, locale, } = useGTContext(`<T> used on the client-side outside of <GTProvider>`);
    const defaultLocale = useDefaultLocale();
    const taggedChildren = useMemo(() => addGTIdentifier(children), [children]);
    // ----- FETCH TRANSLATION ----- //
    // (checking cache is handled by GTProvider)
    // Calculate necessary info for fetching tx/generating tx
    const context = props.context;
    const [childrenAsObjects, hash] = useMemo(() => {
        if (translationRequired) {
            const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
            const hash = hashJsxChildren(Object.assign({ source: childrenAsObjects }, (context && { context })));
            return [childrenAsObjects, hash];
        }
        else {
            return [undefined, ''];
        }
    }, [context, taggedChildren, translationRequired, children]);
    // key is identifier for tx
    // in development, only use hash (this nullifies cache in dev, but the dev cache will be hashes only in future anyways)
    const key = process.env.NODE_ENV === 'development' ? hash : id || hash;
    // Do translation if required
    const translationEntry = translations === null || translations === void 0 ? void 0 : translations[key];
    useEffect(() => {
        // skip if:
        if (!runtimeTranslationEnabled || // runtime translation disabled
            !translationRequired || // no translation required
            !translations || // cache not checked yet
            !locale // locale not loaded
        ) {
            return;
        }
        // skip if: already have translation and hash matches
        if (translationEntry && // already have translation
            (translationEntry.state !== 'success' || translationEntry.hash === hash) // hash matches
        ) {
            return;
        }
        // Translate content
        translateChildren({
            source: childrenAsObjects,
            targetLocale: locale,
            metadata: {
                id,
                hash,
                context,
            },
        });
    }, [
        runtimeTranslationEnabled,
        translations,
        translationEntry,
        translationRequired,
        id,
        hash,
        context,
        locale,
        children,
    ]);
    // ----- RENDER METHODS ----- //
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
    // ----- RENDER BEHAVIOR ----- //
    // fallback if:
    if (!translationRequired || // no translation required
        !translationEnabled || // translation not enabled
        (translations && !translationEntry && !runtimeTranslationEnabled) || // cache miss and dev runtime translation disabled (production)
        (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === 'error' // error fetching translation
    ) {
        return _jsx(React.Fragment, { children: renderDefaultLocale() });
    }
    // loading behavior (checking cache or fetching runtime translation)
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
    // render translated content
    return (_jsx(React.Fragment, { children: renderTranslation(translationEntry.target) }));
}
T.gtTransformation = 'translate-client';
export default T;
