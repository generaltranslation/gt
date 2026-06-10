import { Branch as CoreBranch } from 'gt-react/context';
import { getRequestConditions } from '../request/getRequestConditions';
import type { ReactNode } from 'react';

type BranchProps = Parameters<typeof CoreBranch>[0];

export async function Branch(props: BranchProps): Promise<ReactNode> {
  const conditions = await getRequestConditions();
  return <CoreBranch {...props} {...conditions} />;
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
