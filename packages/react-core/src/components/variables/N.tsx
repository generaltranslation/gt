import { GtInternalNum } from './Num';
import { toNumProps, type NProps } from './N.shared';

// ===== Component ===== //

/**
 * The count of the `<Plural>` it is in, formatted as a number, as `#` is in
 * ICU. A translation can show it in any branch of that plural.
 */
function N(props: NProps): React.JSX.Element {
  return <GtInternalNum {...toNumProps(props)} />;
}

/** @internal _gtt - The GT transformation for the component. */
N._gtt = 'variable-count';

// ===== Exports ===== //

export { N };
