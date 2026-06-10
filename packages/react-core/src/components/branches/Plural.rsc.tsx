import type { ReactNode } from 'react';
import { renderPlural, type ResolvedPluralProps } from './Plural.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalPlural(props: ResolvedPluralProps): ReactNode {
  return renderPlural(props);
}

function RscPlural(props: ResolvedPluralProps): React.JSX.Element {
  return <RscGtInternalPlural {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscPlural._gtt = 'plural';
RscGtInternalPlural._gtt = 'plural-automatic';

// ===== Exports ===== //

export { RscGtInternalPlural, RscPlural };
