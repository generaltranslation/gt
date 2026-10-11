import { computeNum, type ResolvedNumProps } from './Num.shared';
import type { GTComponentMetadata } from '../../utils/types';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalNum(props: ResolvedNumProps): string | null {
  return computeNum(props);
}

function RscNum(props: ResolvedNumProps): React.JSX.Element {
  return <RscGtInternalNum {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
RscNum._gtt = {
  kind: 'variable',
  variableType: 'number',
} satisfies GTComponentMetadata;
RscGtInternalNum._gtt = {
  kind: 'variable',
  variableType: 'number',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { RscGtInternalNum, RscNum };
