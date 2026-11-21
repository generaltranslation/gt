import type { ReactNode } from 'react';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { renderPlural, type PluralProps } from './Plural.shared';
import type { GTMarker } from '../../utils/marker';

// ===== Component ===== //

function GtInternalPlural(props: PluralProps): ReactNode {
  return renderPlural({
    ...props,
    _locale: useLocale(),
    _enableI18n: useEnableI18n(),
  });
}

function Plural(props: PluralProps): React.JSX.Element {
  return <GtInternalPlural {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = { kind: 'plural' } satisfies GTMarker;
GtInternalPlural._gtt = { kind: 'plural', automatic: true } satisfies GTMarker;

// ===== Exports ===== //

export { GtInternalPlural, Plural };
