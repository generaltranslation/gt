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
import { useContext } from 'react';
import { getPluralBranch } from '../../internal';
import { createPluralMissingError } from '../../messages/createMessages';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { GTContext } from '../../provider/GTContext';
/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural n={1} one="There is 1 item">
 *   There are {n} items
 * </Plural>
 * ```
 * In this example, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @param {string} [locale] - Optional parameter, the locale to use for pluralization format. If not provided and wrapped
 *  in <GTProvider> will automatically populate this value as user's current locale. If not provided and not wrapped in
 *  <GTProvider>, will use the library default locale (en-US).
 * @returns {JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
function Plural(_a) {
    var { children, n, locale } = _a, props = __rest(_a, ["children", "n", "locale"]);
    const { 'data-_gt': generaltranslation } = props, branches = __rest(props, ['data-_gt']);
    const context = useContext(GTContext);
    let defaultLocale;
    if (context) {
        locale || (locale = context.locale);
        defaultLocale || (defaultLocale = context.defaultLocale);
    }
    const providerLocales = [
        ...(locale ? [locale] : []),
        defaultLocale || libraryDefaultLocale,
    ];
    if (typeof n !== 'number')
        throw new Error(createPluralMissingError(children));
    const branch = getPluralBranch(n, providerLocales, branches) || children;
    return (_jsx("span", { "data-_gt": generaltranslation, "data-_gt-n": n, style: { display: 'contents' }, children: branch }));
}
Plural.gtTransformation = 'plural';
export default Plural;
