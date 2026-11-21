import type { ReactNode } from 'react';
import { renderPlural, type ResolvedPluralProps } from './Plural.shared';
import type { GTMarker } from '../../utils/marker';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalOrdinal(props: ResolvedPluralProps): ReactNode {
  return renderPlural(props, true);
}

function RscOrdinal(props: ResolvedPluralProps): React.JSX.Element {
  return <RscGtInternalOrdinal {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscOrdinal._gtt = { kind: 'ordinal' } satisfies GTMarker;
RscGtInternalOrdinal._gtt = {
  kind: 'ordinal',
  automatic: true,
} satisfies GTMarker;

// ===== Exports ===== //

export { RscGtInternalOrdinal, RscOrdinal };
