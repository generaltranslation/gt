import getPluralBranch from '../../utils/plurals/getPluralBranch';
import { getFormatLocales } from '../../hooks/format-locales';
import type { ReactNode } from 'react';

type PluralProps = {
  children?: ReactNode;
  n: number;
  locales?: string[];
  _locale?: string;
  _enableI18n?: boolean;
  [key: string]: ReactNode;
};

type ResolvedPluralProps = PluralProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computePlural({
  _enableI18n,
  _locale,
  children,
  n,
  locales: localesProp = [],
  ...branches
}: ResolvedPluralProps): ReactNode {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
    localesProp,
  });
  if (typeof n !== 'number') {
    return children;
  }
  return getPluralBranch(n, locales, branches) || children;
}

export { computePlural };
export type { PluralProps, ResolvedPluralProps };
