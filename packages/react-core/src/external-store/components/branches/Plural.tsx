import getPluralBranch from '../../../branches/plurals/getPluralBranch';
import { useLocale } from '../../hooks/condition-hooks';
import { useDefaultLocale } from '../../hooks/i18n-manager-hooks';
import type { ReactNode } from 'react';

// ===== Component ===== //

function Plural({
  children,
  n,
  locales: localesProp,
  ...branches
}: {
  children?: ReactNode;
  n: number;
  locales?: string;
  [key: string]: ReactNode;
}): ReactNode {
  const locale = useLocale();
  const defaultLocale = useDefaultLocale();
  const locales = [
    ...(localesProp ? [localesProp] : []),
    locale,
    defaultLocale,
  ];
  if (typeof n !== 'number') {
    return children;
  }
  return getPluralBranch(n, locales, branches) || children;
}

function GtInternalPlural(props: {
  children?: ReactNode;
  n: number;
  locales?: string;
  [key: string]: ReactNode;
}): ReactNode {
  return Plural(props);
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';

// ===== Exports ===== //

export { GtInternalPlural, Plural };
