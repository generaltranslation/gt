import type { ReactNode } from 'react';
import { computeBranch } from './computeBranch';
import type { BranchProps } from './computeBranch';

// ===== Component ===== //

/**
 * External-store version of the `<Branch>` component.
 */
function GtInternalBranch({ ...props }: BranchProps): ReactNode {
  return computeBranch(props);
}

function Branch(props: BranchProps): React.JSX.Element {
  return <GtInternalBranch {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';

// ===== Exports ===== //

export { GtInternalBranch, Branch };
