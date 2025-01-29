import React from "react";
import { getPluralBranch } from "../../internal";
import useLocale from "../../hooks/useLocale";
import useDefaultLocale from "../../hooks/useDefaultLocale";
import { createPluralMissingError } from "../../messages/createMessages";

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
 * @returns {JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
function Plural({
    children, n, ...props
}: {
    children?: any;
    n?: number;
    [key: string]: any;
}) {
    const { 'data-_gt': generaltranslation, ...branches } = props;
    const locale = useLocale();
    const defaultLocale = useDefaultLocale();
    if (typeof n !== 'number') 
        throw new Error(createPluralMissingError(children));
    const branch = getPluralBranch(n, [locale, defaultLocale], branches) || children;
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