import type { ReactNode } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { renderPlural, type PluralProps } from './Plural.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalOrdinal(props: PluralProps): ReactNode {
  return renderPlural(
    {
      ...props,
      _locale: useLocale(),
      _enableI18n: useEnableI18n(),
    },
    true
  );
}

function Ordinal(props: PluralProps): React.JSX.Element {
  return <GtInternalOrdinal {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Ordinal._gtt = { kind: 'ordinal' } satisfies GTMarker;
GtInternalOrdinal._gtt = {
  kind: 'ordinal',
  automatic: true,
} satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalOrdinal, Ordinal };
