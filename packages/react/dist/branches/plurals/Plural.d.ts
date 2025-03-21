/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural
 *  n={1}
 *  one="There is 1 item"
 *  other="There are {n} items"
 * />
 * ```
 * In this example, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @param {string} [locale] - Optional parameter, the locale to use for pluralization format. If not provided and wrapped
 *  in <GTProvider> will automatically populate this value as user's current locale. If not provided and not wrapped in
 *  <GTProvider>, will use the library default locale (en-US).
 * @param {...{[key: string]: any}} [branches] - A spread object containing possible plural branches, typically including `one` for singular
 * and `other` for plural forms, but it may vary depending on the locale.
 * @returns {React.JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
declare function Plural({ children, n, locale, ...branches }: {
    children?: any;
    n?: number;
    locale?: string;
    [key: string]: any;
}): import("react/jsx-runtime").JSX.Element;
declare namespace Plural {
    var gtTransformation: string;
}
export default Plural;
//# sourceMappingURL=Plural.d.ts.map