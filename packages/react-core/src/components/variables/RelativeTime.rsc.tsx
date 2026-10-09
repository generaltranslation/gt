import {
  computeRelativeTime,
  type ResolvedRelativeTimeProps,
} from './RelativeTime.shared';
import type { GTComponentMetadata } from '../../utils/types';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalRelativeTime(
  props: ResolvedRelativeTimeProps
): string | null {
  return computeRelativeTime(props);
}

function RscRelativeTime(props: ResolvedRelativeTimeProps): React.JSX.Element {
  return <RscGtInternalRelativeTime {...props} />;
}

/** @internal _gtt - The GT metadata for the component. */
RscRelativeTime._gtt = {
  kind: 'variable',
  variableType: 'relative-time',
} satisfies GTComponentMetadata;
RscGtInternalRelativeTime._gtt = {
  kind: 'variable',
  variableType: 'relative-time',
  injection: 'automatic',
} satisfies GTComponentMetadata;

// ===== Exports ===== //

export { RscGtInternalRelativeTime, RscRelativeTime };
