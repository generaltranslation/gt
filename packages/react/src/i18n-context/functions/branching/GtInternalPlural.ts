import React from 'react';
import { getPluralBranch } from '@generaltranslation/react-core/internal';
import { getDefaultLocale, getLocale } from '../locale-operations';

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
}: {
  children?: React.ReactNode;
  n: number;
  locales?: string;
  [key: string]: React.ReactNode;
}): React.ReactNode {
  const locales = [
    ...(localesProp ? [localesProp] : []),
    getLocale(),
    getDefaultLocale(),
  ];
  if (typeof n !== 'number') {
    return children;
  }
  const branch = getPluralBranch(n, locales, branches);
  return branch != null ? (branch as React.ReactNode) : children;
}

/**
 * Equivalent to the `<Plural>` component, but used for auto insertion.
 */
function GtInternalPlural(props: {
  children?: React.ReactNode;
  n: number;
  locales?: string;
  [key: string]: React.ReactNode;
}): React.ReactNode {
  return Plural(props);
}

/** @internal _gtt - The GT transformation and injection identifier for the component. */
Plural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';

export { GtInternalPlural, Plural };
