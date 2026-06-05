import type { ReactNode } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { computePlural } from './computePlural';
import type { PluralProps } from './computePlural';

// ===== Component ===== //

function GtInternalPlural({
  _enableI18n,
  _locale,
  ...props
}: PluralProps): ReactNode {
  const locale = _locale ?? useLocale();
  const enableI18n = _enableI18n ?? useEnableI18n();
  return computePlural({
    ...props,
    _locale: locale,
    _enableI18n: enableI18n,
  });
}

function Plural(props: PluralProps): React.JSX.Element {
  return <GtInternalPlural {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';

// ===== Exports ===== //

export { GtInternalPlural, Plural };
