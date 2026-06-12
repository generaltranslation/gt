import {
  computeRelativeTime,
  type ResolvedRelativeTimeProps,
} from './RelativeTime.shared';

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

/** @internal _gtt - The GT transformation for the component. */
RscRelativeTime._gtt = 'variable-relative-time';
RscGtInternalRelativeTime._gtt = 'variable-relative-time-automatic';

// ===== Exports ===== //

export { RscGtInternalRelativeTime, RscRelativeTime };
