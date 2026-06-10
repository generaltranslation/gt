import getPluralBranch from '../../utils/plurals/getPluralBranch';
import type { ReactNode } from 'react';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure render logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

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

function renderPlural({
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

export { renderPlural };
export type { PluralProps, ResolvedPluralProps };
