import { reportMissingCount } from '../../utils/plurals/getPluralBranch';
import { RscGtInternalNum } from './Num.rsc';
import type { ResolvedNProps } from './N.shared';

// RSC implementation: request conditions are passed explicitly instead of
// being read from hooks. This module must stay free of hook/context imports
// so it can be exported from the components-rsc entrypoint.

function RscN({ _count, ...conditions }: ResolvedNProps): React.JSX.Element {
  if (_count === undefined) reportMissingCount();
  return <RscGtInternalNum {...conditions}>{_count}</RscGtInternalNum>;
}

/** @internal _gtt - The GT transformation for the component. */
RscN._gtt = 'variable-count';

// ===== Exports ===== //

export { RscN };
