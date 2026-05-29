import getPluralBranch from '../../utils/plurals/getPluralBranch';
import type { ReactNode } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

type PluralProps = {
  children?: ReactNode;
  n: number;
  locales?: string[];
  _locale?: string;
  _enableI18n?: boolean;
  [key: string]: ReactNode;
};

// ===== Component ===== //

function GtInternalPlural({
  _enableI18n,
  _locale,
  children,
  n,
  locales: localesProp = [],
  ...branches
}: PluralProps): ReactNode {
  const locale = _locale ?? useLocale();
  const enableI18n = _enableI18n ?? useEnableI18n();
  const locales = getFormatLocales({ locale, enableI18n, localesProp });
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
