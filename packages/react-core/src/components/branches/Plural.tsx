import type { ReactNode } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { renderPlural, type PluralProps } from './Plural.shared';
import type { GTComponentMetadata } from '../../utils/types';

// ===== Component ===== //

function GtInternalPlural({
  _enableI18n,
  _locale,
  ...props
}: PluralProps): ReactNode {
  return renderPlural({
    ...props,
    _locale: _locale ?? useLocale(),
    _enableI18n: _enableI18n ?? useEnableI18n(),
  });
}

function Plural(props: PluralProps): React.JSX.Element {
  return <GtInternalPlural {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
Plural._gtt = { kind: 'plural' } satisfies GTComponentMetadata;
GtInternalPlural._gtt = {
  kind: 'plural',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { GtInternalPlural, Plural };
