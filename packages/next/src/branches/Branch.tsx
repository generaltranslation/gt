import { Branch as CoreBranch } from 'gt-react';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type BranchValue = string | number | boolean;
type BranchProps<V extends BranchValue> = Parameters<typeof CoreBranch<V>>[0];

export async function Branch<V extends BranchValue>(
  props: BranchProps<V>
): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  // The branches were checked against V above; any value type takes them.
  return (
    <CoreBranch {...(props as BranchProps<BranchValue>)} {...conditions} />
  );
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
