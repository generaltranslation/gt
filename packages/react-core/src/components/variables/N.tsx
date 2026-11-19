import { reportMissingCount } from '../../utils/plurals/getPluralBranch';
import { GtInternalNum } from './Num';
import type { NProps } from './N.shared';

// ===== Component ===== //

/**
 * The count of the `<Plural>` it is in, formatted as a number, as `#` is in
 * ICU. A translation can show it in any branch of that plural.
 */
function N({ _count }: NProps): React.JSX.Element {
  if (_count === undefined) reportMissingCount();
  return <GtInternalNum>{_count}</GtInternalNum>;
}

/** @internal _gtt - The GT transformation for the component. */
N._gtt = 'variable-count';

// ===== Exports ===== //

export { N };
