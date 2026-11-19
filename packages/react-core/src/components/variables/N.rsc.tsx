import { RscGtInternalNum } from './Num.rsc';
import { toNumProps, type ResolvedNProps } from './N.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscN(props: ResolvedNProps): React.JSX.Element {
  return <RscGtInternalNum {...toNumProps(props)} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscN._gtt = 'variable-count';

// ===== Exports ===== //

export { RscN };
