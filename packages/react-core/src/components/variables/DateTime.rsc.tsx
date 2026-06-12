import { computeDateTime, type ResolvedDateTimeProps } from './DateTime.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscGtInternalDateTime(props: ResolvedDateTimeProps): string | null {
  return computeDateTime(props);
}

function RscDateTime(props: ResolvedDateTimeProps): React.JSX.Element {
  return <RscGtInternalDateTime {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscDateTime._gtt = 'variable-datetime';
RscGtInternalDateTime._gtt = 'variable-datetime-automatic';

// ===== Exports ===== //

export { RscDateTime, RscGtInternalDateTime };
