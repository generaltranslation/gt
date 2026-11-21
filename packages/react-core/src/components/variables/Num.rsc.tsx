import { computeNum, type ResolvedNumProps } from './Num.shared';
import type { GTMarker } from '../../utils/marker';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalNum(props: ResolvedNumProps): string | null {
  return computeNum(props);
}

function RscNum(props: ResolvedNumProps): React.JSX.Element {
  return <RscGtInternalNum {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscNum._gtt = { kind: 'variable', variableType: 'n' } satisfies GTMarker;
RscGtInternalNum._gtt = {
  kind: 'variable',
  variableType: 'n',
  automatic: true,
} satisfies GTMarker;

// ===== Exports ===== //

export { RscGtInternalNum, RscNum };
