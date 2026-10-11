import { computeDateTime, type ResolvedDateTimeProps } from './DateTime.shared';
import type { GTComponentMetadata } from '../../utils/types';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalDateTime(props: ResolvedDateTimeProps): string | null {
  return computeDateTime(props);
}

function RscDateTime(props: ResolvedDateTimeProps): React.JSX.Element {
  return <RscGtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
RscDateTime._gtt = {
  kind: 'variable',
  variableType: 'datetime',
} satisfies GTComponentMetadata;
RscGtInternalDateTime._gtt = {
  kind: 'variable',
  variableType: 'datetime',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { RscDateTime, RscGtInternalDateTime };
