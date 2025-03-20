import { useContext } from 'react';
import { getPluralBranch } from '../../internal';
import { createPluralMissingError } from '../../errors/createErrors';
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
function Plural({
  children,
  n,
  locale,
  ...props
}: {
  children?: any;
  n?: number;
  locale?: string;
  [key: string]: any;
}) {
  const { 'data-_gt': generaltranslation, ...branches } = props;
  const context = useContext(GTContext);
  let defaultLocale;
  if (context) {
    locale ||= context.locale;
    defaultLocale ||= context.defaultLocale;
  }
  const providerLocales = [
    ...(locale ? [locale] : []),
    defaultLocale || libraryDefaultLocale,
  ];
  if (typeof n !== 'number')
    throw new Error(createPluralMissingError(children));
  const branch = getPluralBranch(n, providerLocales, branches) || children;
  return <>{branch}</>;
}

Plural.gtTransformation = 'plural';

export default Plural;
