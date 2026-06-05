import { GtInternalDerive } from '@generaltranslation/react-core/context';
import type { ReactNode } from 'react';

type DeriveProps<T extends ReactNode> = Parameters<
  typeof GtInternalDerive<T>
>[0];

// ===== Component ===== //

function RscDerive<T extends ReactNode>(
  props: DeriveProps<T>
): React.JSX.Element {
  return <GtInternalDerive {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
RscDerive._gtt = 'derive';

// ===== Exports ===== //

export { RscDerive };
