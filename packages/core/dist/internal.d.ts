declare const defaultCacheUrl: "https://cdn.gtx.dev";
declare const defaultBaseUrl: "https://api.gtx.dev";
declare const defaultRuntimeApiUrl: "https://runtime.gtx.dev";

declare const libraryDefaultLocale: "en";

declare const pluralForms: readonly ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other"];
type PluralType = (typeof pluralForms)[number];
declare function isAcceptedPluralForm(form: string): form is PluralType;

/**
 * Given a number and a list of allowed plural forms, return the plural form that best fits the number.
 *
 * @param {number} n - The number to determine the plural form for.
 * @param {locales[]} forms - The allowed plural forms.
 * @returns {PluralType} The determined plural form, or an empty string if none fit.
 */
declare function _getPluralForm(n: number, forms?: PluralType[], locales?: string[]): PluralType | '';

type Variable = {
    variable?: string;
    id?: string | number;
    key: string;
};
type Content = string | Array<string | Variable>;
type JsxElement = {
    type: string;
    props: {
        'data-_gt'?: {
            id: number;
            transformation?: string;
            branches?: Record<string, JsxChildren>;
        };
        children?: JsxChildren;
    };
};
type JsxChild = string | JsxElement | Variable;
type JsxChildren = JsxChild | JsxChild[];

export { type Content, type JsxChild, type JsxChildren, type JsxElement, defaultBaseUrl, defaultCacheUrl, defaultRuntimeApiUrl, _getPluralForm as getPluralForm, isAcceptedPluralForm, libraryDefaultLocale, pluralForms };
