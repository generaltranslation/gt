import type { ReactNode } from 'react';
import { computeBranch } from './computeBranch';
import type { BranchProps } from './computeBranch';

// ===== Component ===== //

/**
 * RSC version of the `<Branch>` component. Branch selection is
 * locale-independent.
 */
function RscBranch(props: BranchProps): ReactNode {
  return computeBranch(props);
}

/** @internal _gtt - The GT transformation for the component. */
RscBranch._gtt = 'branch';

// ===== Exports ===== //

export { RscBranch };
