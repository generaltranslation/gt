import { computeNum, type ResolvedNumProps } from './Num.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the context-rsc entrypoint.

function RscGtInternalNum(props: ResolvedNumProps): string | null {
  return computeNum(props);
}

function RscNum(props: ResolvedNumProps): React.JSX.Element {
  return <RscGtInternalNum {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscNum._gtt = 'variable-number';
RscGtInternalNum._gtt = 'variable-number-automatic';

// ===== Exports ===== //

export { RscGtInternalNum, RscNum };
