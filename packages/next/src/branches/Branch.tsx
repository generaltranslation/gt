import { RscBranch } from 'gt-react/context';
import { withRequestConditions } from '../request/asyncConditionStore';
import type { ReactNode } from 'react';

type BranchProps = Parameters<typeof RscBranch>[0];

export async function Branch(props: BranchProps): Promise<ReactNode> {
  return withRequestConditions(() => RscBranch(props));
}

/** @internal _gtt - The GT transformation for the component. */
Branch._gtt = 'branch';
