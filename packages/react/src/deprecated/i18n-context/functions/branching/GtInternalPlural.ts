import type { ReactNode } from 'react';
import { getPluralBranch } from '@generaltranslation/react-core/internal';
import { getDefaultLocale, getLocale } from '../locale-operations';

type PluralProps = {
  children?: ReactNode;
  n: number;
  locales?: string;
  [key: string]: ReactNode;
};

/**
 * The `<Plural>` component dynamically renders content based on the plural
 * form of the given number (`n`).
 *
 * This is the i18n-context version — uses singleton locale instead of React Context.
 */
function Plural({
  children,
  n,
  locales: localesProp,
  ...branches
}: PluralProps): ReactNode {
  const locales = [
    ...(localesProp ? [localesProp] : []),
    getLocale(),
    getDefaultLocale(),
  ];
  if (typeof n !== 'number') {
    return children;
  }
  const branch = getPluralBranch(n, locales, branches);
  return branch != null ? (branch as ReactNode) : children;
}

/**
 * Equivalent to the `<Plural>` component, but used for auto insertion.
 */
function GtInternalPlural(props: PluralProps): ReactNode {
  return Plural(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Plural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';

export { GtInternalPlural, Plural };
