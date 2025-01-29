"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const useDefaultLocale_1 = __importDefault(require("../hooks/useDefaultLocale"));
const useLocale_1 = __importDefault(require("../hooks/useLocale"));
const renderDefaultChildren_1 = __importDefault(require("../provider/rendering/renderDefaultChildren"));
const internal_1 = require("../internal");
const GTContext_1 = __importDefault(require("../provider/GTContext"));
const renderTranslatedChildren_1 = __importDefault(require("../provider/rendering/renderTranslatedChildren"));
const react_2 = require("react");
const renderVariable_1 = __importDefault(require("../provider/rendering/renderVariable"));
const createMessages_1 = require("../messages/createMessages");
const id_1 = require("generaltranslation/id");
const renderSkeleton_1 = __importDefault(require("../provider/rendering/renderSkeleton"));
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
    var _b;
    var { children, id } = _a, props = __rest(_a, ["children", "id"]);
    if (!children)
        return undefined;
    if ((0, internal_1.isEmptyReactFragment)(children))
        return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, {});
    if (!id)
        throw new Error((0, createMessages_1.createClientSideTWithoutIdError)(children));
    const { variables, variablesOptions } = props;
    const { translations, translationRequired, dialectTranslationRequired, translateChildren, renderSettings } = (0, GTContext_1.default)(`<T id="${id}"> used on the client-side outside of <GTProvider>`);
    const locale = (0, useLocale_1.default)();
    const defaultLocale = (0, useDefaultLocale_1.default)();
    const taggedChildren = (0, react_2.useMemo)(() => (0, internal_1.addGTIdentifier)(children), [children]);
    // ----- FETCH TRANSLATION ----- //
    // Calculate necessary info for fetching tx/generating tx
    const context = props.context;
    const [childrenAsObjects, hash] = (0, react_2.useMemo)(() => {
        if (translationRequired) {
            const childrenAsObjects = (0, internal_1.writeChildrenAsObjects)(taggedChildren);
            const hash = (0, id_1.hashJsxChildren)(Object.assign({ source: childrenAsObjects }, (context && { context })));
            return [childrenAsObjects, hash];
        }
        else {
            return [undefined, ''];
        }
    }, [context, taggedChildren, translationRequired]);
    // Do translation if required
    const translationEntry = (_b = translations === null || translations === void 0 ? void 0 : translations[id]) === null || _b === void 0 ? void 0 : _b[hash];
    (0, react_1.useEffect)(() => {
        // skip if: no translation required
        if (!translationRequired)
            return;
        // skip if: no fetch if cache hasn't been hit yet or we already have the translation
        if (!translations || translationEntry)
            return;
        // Translate content
        translateChildren({
            source: childrenAsObjects,
            targetLocale: locale,
            metadata: {
                id, hash, context
            }
        });
    }, [translations, translationEntry, translationRequired, id, hash, context]);
    // ----- RENDER METHODS ----- // 
    // for default/fallback rendering
    const renderDefaultLocale = () => {
        return (0, renderDefaultChildren_1.default)({
            children: taggedChildren,
            variables,
            variablesOptions,
            defaultLocale,
            renderVariable: renderVariable_1.default
        });
    };
    const renderLoadingDefault = () => {
        if (dialectTranslationRequired) {
            return renderDefaultLocale();
        }
        return (0, renderSkeleton_1.default)();
    };
    const renderTranslation = (target) => {
        return (0, renderTranslatedChildren_1.default)({
            source: taggedChildren,
            target,
            variables,
            variablesOptions,
            locales: [locale, defaultLocale],
            renderVariable: renderVariable_1.default
        });
    };
    // ----- RENDER BEHAVIOR ----- //
    // fallback to default locale if no tx required
    if (!translationRequired) {
        return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderDefaultLocale() });
    }
    // loading behavior
    if (!translationEntry || (translationEntry === null || translationEntry === void 0 ? void 0 : translationEntry.state) === "loading") {
        let loadingFallback;
        if (renderSettings.method === "skeleton") {
            loadingFallback = (0, renderSkeleton_1.default)();
        }
        else if (renderSettings.method === "replace") {
            loadingFallback = renderDefaultLocale();
        }
        else { // default
            loadingFallback = renderLoadingDefault();
        }
        // The suspense exists here for hydration reasons
        return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: loadingFallback });
    }
    // error behavior
    if (translationEntry.state === "error") {
        return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderDefaultLocale() });
    }
    // render translated content
    return (0, jsx_runtime_1.jsx)(react_1.default.Fragment, { children: renderTranslation(translationEntry.target) });
}
T.gtTransformation = "translate-client";
exports.default = T;
//# sourceMappingURL=T.js.map