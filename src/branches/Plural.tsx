import { getPluralBranch } from "gt-react/internal";
import getI18NConfig from "../config/getI18NConfig";

/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural n={n} one={<>There is <Num value={n}/> item.</>}>
 *   There are <Num value={n}/> items.
 * </Plural>
 * ```
 * In this example, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @param {object} [branches] - An object containing possible plural branches, typically including `one` for singular
 * and `other` for plural forms, but it may vary depending on the locale.
 * @returns {Promise<JSX.Element>} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
function Plural({
    children, n, 
    locales = [getI18NConfig().getDefaultLocale()], 
    ...props
}: {
    children?: any;
    n?: number;
    'data-_gt'?: any
    locales?: string[]
    [key: string]: any
}) {
    const { 'data-_gt': generaltranslation, ...branches } = props;
    const branch = (typeof n === 'number' ? getPluralBranch(n, locales, branches) : children) || children;
    return (
        <span 
            data-_gt={generaltranslation} 
            data-_gt-n={n}
            style={{ display: 'contents' }}
        >
            {branch}
        </span>
    );
}

Plural.gtTransformation = "plural";

export default Plural;