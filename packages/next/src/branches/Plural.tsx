import { getPluralBranch } from 'gt-react/internal';
import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';

/**
 * The `<Plural>` component dynamically renders content based on the plural form of the given number (`n`).
 * It determines which content to display by matching the value of `n` to the appropriate pluralization branch,
 * based on the current locale or a default locale. If no matching plural branch is found, the component renders
 * the fallback `children` content.
 *
 * @example
 * ```jsx
 * <Plural
 *  n={n}
 *  one={<>There is <Num children={n}/> item.</>}
 *  other={<>There are <Num children={n}/> items.</>}
 * />
 * ```
 * In this ex ample, if `n` is 1, it renders `"There is 1 item"`. If `n` is a different number, it renders
 * `"There are {n} items"`.
 *
 * @param {any} [children] - Fallback content to render if no matching plural branch is found.
 * @param {number} [n] - The number used to determine the plural form. This is required for pluralization to work.
 * @param {...branches} [branches] - A spread object containing possible plural branches, typically including `one` for singular
 * and `other` for plural forms, but it may vary depending on the locale.
 * @returns {React.JSX.Element} The rendered content corresponding to the plural form of `n`, or the fallback content.
 * @throws {Error} If `n` is not provided or not a valid number.
 */
function Plural({
  children,
  n,
  locales = [useLocale(), getI18NConfig().getDefaultLocale()],
  ...branches
}: {
  children?: React.ReactNode;
  n?: number;
  locales?: string[];
  [key: string]: any;
}) {
  return (
    <>
      {(typeof n === 'number'
        ? getPluralBranch(n, locales, branches)
        : children) || children}
    </>
  );
}

Plural._gtt = 'plural';

export default Plural;
