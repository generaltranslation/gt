import getPluralBranch from '../../utils/plurals/getPluralBranch';
import type { ReactNode } from 'react';
import { useFormatLocales } from '../../hooks/utils';

type PluralProps = {
  children?: ReactNode;
  n: number;
  locales?: string[];
  [key: string]: ReactNode;
};

// ===== Component ===== //

function GtInternalPlural({
  children,
  n,
  locales: localesProp = [],
  ...branches
}: PluralProps): ReactNode {
  const locales = useFormatLocales(localesProp);
  if (typeof n !== 'number') {
    return children;
  }
  return getPluralBranch(n, locales, branches) || children;
}

function Plural(props: PluralProps): React.JSX.Element {
  return <GtInternalPlural {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';

// ===== Exports ===== //

export { GtInternalPlural, Plural };
