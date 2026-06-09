import type { ReactNode } from 'react';
import { computeDerive } from './computeDerive';
import type { DeriveProps } from './computeDerive';

// ===== Component ===== //

/**
 * RSC version of the `<Derive>` component.
 */
function RscDerive<T extends ReactNode>({ children }: DeriveProps<T>): T {
  return computeDerive({ children });
}

/** @internal _gtt - The GT transformation for the component. */
RscDerive._gtt = 'derive';

// ===== Exports ===== //

export { RscDerive };
