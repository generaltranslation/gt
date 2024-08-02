var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { lazy } from 'react';
import addGTIdentifier from './helpers/addGTIdentifier';
import writeChildrenAsObjects from './helpers/writeChildrenAsObjects';
import generateHash from './helpers/generateHash';
import renderChildren from './renderChildren';
import { getLanguageDirection } from 'generaltranslation';
const ReplaceResolver = lazy(() => import('./resolvers/ReplaceResolver'));
const SkeletonResolver = lazy(() => import('./resolvers/SkeletonResolver'));
export default function ServerI18N(_a) {
    return __awaiter(this, void 0, void 0, function* () {
        var { I18NConfig, children, locale } = _a, props = __rest(_a, ["I18NConfig", "children", "locale"]);
        // Handle case where translation is not required, for example if the user's browser is in the default locale
        const translationRequired = (children && I18NConfig.translationRequired(locale)) ? true : false;
        if (!translationRequired) {
            return (_jsx(_Fragment, { children: children }));
        }
        // Fetch translations
        const translationsPromise = I18NConfig.getTranslations(locale, props.dictionaryName);
        const defaultLocale = I18NConfig.getDefaultLocale();
        let renderAttributes = {};
        const dir = getLanguageDirection(locale);
        if (dir === 'rtl')
            renderAttributes = Object.assign(Object.assign({}, renderAttributes), { dir });
        const taggedChildren = addGTIdentifier(children);
        const childrenAsObjects = writeChildrenAsObjects(taggedChildren);
        const key = yield generateHash(childrenAsObjects);
        const id = props.id ? props.id : key;
        const translations = yield translationsPromise;
        const translation = (translations && translations[id] && translations[id].k === key) ? translations[id].t : null;
        // Check if a translation for this site already exists and return it if it does
        const translationExists = translation ? true : false;
        if (translationExists) {
            const I18NChildren = renderChildren({ source: taggedChildren, target: translation, renderAttributes, locale, defaultLocale });
            return (_jsx(_Fragment, { children: I18NChildren }));
        }
        // Check if a new translation for this site can be created
        const renderSettings = I18NConfig.getRenderSettings();
        if (!I18NConfig.automaticTranslationEnabled()) {
            return (_jsx(_Fragment, { children: children }));
        }
        // Create a new translation for this site and render it
        const I18NChildrenPromise = I18NConfig.translateChildren({ children: childrenAsObjects, targetLanguage: locale, metadata: Object.assign({}, props) });
        const renderMethod = (props === null || props === void 0 ? void 0 : props.renderMethod) || renderSettings.method;
        const timeout = renderSettings === null || renderSettings === void 0 ? void 0 : renderSettings.timeout;
        if (renderMethod === "skeleton") {
            // Return the site but without text
            // Replace with translated site when ready
            let promise = I18NChildrenPromise.then(target => renderChildren({ source: taggedChildren, target, renderAttributes, locale, defaultLocale }));
            if (typeof timeout === 'number') {
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(children), timeout));
                promise = Promise.race([promise, timeoutPromise]);
            }
            return (_jsx(_Fragment, { children: _jsx(SkeletonResolver, { fallback: children, children: promise }) }));
        }
        if (renderMethod === "replace") {
            // Return the site in the default language
            // Replace with translated site when ready
            let promise = I18NChildrenPromise.then(target => renderChildren({ source: taggedChildren, target, renderAttributes, locale, defaultLocale }));
            if (typeof timeout === 'number') {
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(children), timeout));
                promise = Promise.race([promise, timeoutPromise]);
            }
            return (_jsx(_Fragment, { children: _jsx(ReplaceResolver, { fallback: children, children: promise }) }));
        }
        if (renderMethod === "hang") {
            // Wait until the site is translated to return
            const renderPromise = I18NChildrenPromise.then(target => renderChildren({ source: taggedChildren, target, renderAttributes, locale, defaultLocale }));
            if (typeof timeout === 'number') {
                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(children), timeout));
                return (_jsx(_Fragment, { children: yield Promise.race([renderPromise, timeoutPromise]) }));
            }
            return (_jsx(_Fragment, { children: yield renderPromise }));
        }
        return (
        // return the children, with no special rendering
        // a translation may be available from a cached translation dictionary next time the component is loaded
        _jsx(_Fragment, { children: children }));
    });
}
//# sourceMappingURL=ServerI18N.js.map